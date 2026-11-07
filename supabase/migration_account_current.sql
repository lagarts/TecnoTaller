-- =============================================
-- Migración: Cuenta Corriente funcional
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Movimientos de cuenta corriente (cargo = deuda, pago = cobro)
CREATE TABLE IF NOT EXISTS public.account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cargo', 'pago')),
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  method TEXT DEFAULT 'efectivo',
  order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own account movements" ON public.account_movements;
CREATE POLICY "Users can manage own account movements" ON public.account_movements
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Trigger: mantiene account_balances sincronizado con los movimientos
--    saldo positivo = el cliente debe, saldo negativo = tiene a favor
CREATE OR REPLACE FUNCTION public.sync_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client UUID;
  v_balance NUMERIC;
BEGIN
  v_client := COALESCE(NEW.client_id, OLD.client_id);

  SELECT COALESCE(SUM(CASE WHEN type = 'cargo' THEN amount ELSE -amount END), 0)
  INTO v_balance
  FROM public.account_movements
  WHERE client_id = v_client;

  INSERT INTO public.account_balances (client_id, balance, last_payment_at, updated_at)
  VALUES (
    v_client,
    v_balance,
    (SELECT MAX(created_at) FROM public.account_movements WHERE client_id = v_client AND type = 'pago'),
    NOW()
  )
  ON CONFLICT (client_id) DO UPDATE
  SET balance = EXCLUDED.balance,
      last_payment_at = EXCLUDED.last_payment_at,
      updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS account_movements_sync_balance ON public.account_movements;
CREATE TRIGGER account_movements_sync_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.account_movements
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_balance();
