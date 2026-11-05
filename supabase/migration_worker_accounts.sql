-- =============================================
-- Migración: cuentas de trabajadores + confirmación de pagos
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Estado de confirmación en pagos a trabajadores
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente';
ALTER TABLE public.worker_payments ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.worker_payments DROP CONSTRAINT IF EXISTS worker_payments_status_check;
ALTER TABLE public.worker_payments ADD CONSTRAINT worker_payments_status_check CHECK (status IN ('pendiente', 'confirmado'));

-- 2. Email de cuenta en el trabajador
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS account_email TEXT DEFAULT '';

-- 3. Notificaciones dirigidas (user_id NULL = para todos)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;

DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
CREATE POLICY "Users can view notifications" ON public.notifications FOR SELECT USING (
  auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert targeted notifications" ON public.notifications;
CREATE POLICY "Users can insert targeted notifications" ON public.notifications FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND created_by = auth.uid()
);

-- 4. El trabajador puede ver SU registro de trabajador
DROP POLICY IF EXISTS "Workers can view own worker record" ON public.workers;
CREATE POLICY "Workers can view own worker record" ON public.workers FOR SELECT USING (
  profile_id = auth.uid()
);

-- 5. El trabajador puede ver SUS pagos
DROP POLICY IF EXISTS "Workers can view own payments" ON public.worker_payments;
CREATE POLICY "Workers can view own payments" ON public.worker_payments FOR SELECT USING (
  worker_id IN (SELECT id FROM public.workers WHERE profile_id = auth.uid())
);

-- 6. Función para que el trabajador confirme su pago (solo cambia estado)
CREATE OR REPLACE FUNCTION public.confirm_worker_payment(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.worker_payments
  SET status = 'confirmado', confirmed_at = NOW()
  WHERE id = p_id
    AND worker_id IN (SELECT id FROM public.workers WHERE profile_id = auth.uid());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No autorizado o pago no encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_worker_payment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_worker_payment(UUID) TO authenticated;

-- 7. Vincular perfil de trabajador existente si coincide el email
UPDATE public.workers w
SET profile_id = p.id, account_email = p.email
FROM public.profiles p
WHERE w.profile_id IS NULL
  AND p.role = 'worker'
  AND lower(w.email) = lower(p.email);