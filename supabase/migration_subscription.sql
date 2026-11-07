-- =============================================
-- Migración: Suscripción Mercado Pago / PayPal
-- con bloqueo de la app al vencer
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Pagos de suscripción (declarados por usuarios, aprobados por admin)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  method TEXT NOT NULL CHECK (method IN ('mercadopago', 'paypal')),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  prev_access_until TIMESTAMPTZ,
  prev_plan TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view subscription payments" ON public.subscription_payments;
CREATE POLICY "Authenticated can view subscription payments" ON public.subscription_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Ajustes de la app (links de pago configurados por el admin)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view settings" ON public.app_settings;
CREATE POLICY "Authenticated can view settings" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin can update settings" ON public.app_settings;
CREATE POLICY "Admin can update settings" ON public.app_settings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin can insert settings" ON public.app_settings;
CREATE POLICY "Admin can insert settings" ON public.app_settings
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('mp_link', ''), ('paypal_link', '')
ON CONFLICT (key) DO NOTHING;

-- 3. Declarar pago: registra el pago y da 3 días de acceso temporal mientras se verifica
CREATE OR REPLACE FUNCTION public.declare_subscription_payment(
  p_method TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'ARS'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_access TIMESTAMPTZ;
  v_prev_plan TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_method NOT IN ('mercadopago', 'paypal') THEN
    RAISE EXCEPTION 'Método de pago inválido';
  END IF;

  IF EXISTS (
    SELECT 1 FROM subscription_payments
    WHERE user_id = auth.uid() AND status = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Ya hay un pago en verificación';
  END IF;

  SELECT trial_ends_at, subscription_plan INTO v_prev_access, v_prev_plan
  FROM profiles WHERE id = auth.uid();

  INSERT INTO subscription_payments (user_id, method, amount, currency, prev_access_until, prev_plan, created_by)
  VALUES (auth.uid(), p_method, p_amount, p_currency, v_prev_access, v_prev_plan, auth.uid());

  -- Acceso temporal de 3 días (no encoge un acceso vigente ni toca el acceso de por vida)
  IF NOT (v_prev_access IS NULL AND v_prev_plan = 'pro') THEN
    UPDATE profiles
    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW() + INTERVAL '3 days'),
        updated_at = NOW()
    WHERE id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.declare_subscription_payment(TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.declare_subscription_payment(TEXT, NUMERIC, TEXT) TO authenticated;

-- 4. Aprobar pago: activa la suscripción por 1 mes más
CREATE OR REPLACE FUNCTION public.approve_subscription_payment(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden aprobar pagos';
  END IF;

  UPDATE subscription_payments
  SET status = 'aprobado', reviewed_at = NOW(), reviewed_by = auth.uid()
  WHERE id = p_id AND status = 'pendiente'
  RETURNING user_id INTO v_user;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado o ya revisado';
  END IF;

  UPDATE profiles
  SET subscription_plan = 'pro',
      subscription_active = true,
      trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + INTERVAL '1 month',
      updated_at = NOW()
  WHERE id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_subscription_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_subscription_payment(UUID) TO authenticated;

-- 5. Rechazar pago: restaura el acceso anterior (sin acceso temporal)
CREATE OR REPLACE FUNCTION public.reject_subscription_payment(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_prev_access TIMESTAMPTZ;
  v_prev_plan TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden rechazar pagos';
  END IF;

  UPDATE subscription_payments
  SET status = 'rechazado', reviewed_at = NOW(), reviewed_by = auth.uid()
  WHERE id = p_id AND status = 'pendiente'
  RETURNING user_id, prev_access_until, prev_plan INTO v_user, v_prev_access, v_prev_plan;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Pago no encontrado o ya revisado';
  END IF;

  UPDATE profiles
  SET trial_ends_at = v_prev_access,
      subscription_plan = COALESCE(v_prev_plan, subscription_plan),
      updated_at = NOW()
  WHERE id = v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_subscription_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_subscription_payment(UUID) TO authenticated;

-- 6. Todos los usuarios quedan con 1 MES GRATIS desde hoy
UPDATE public.profiles
SET subscription_plan = 'free',
    subscription_active = true,
    trial_ends_at = NOW() + INTERVAL '1 month';
