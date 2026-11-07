-- =============================================
-- Migración: columnas para pagos AUTOMÁTICOS
-- (Mercado Pago webhook / PayPal capture)
-- Ejecutar en Supabase SQL Editor
-- =============================================

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Idempotencia: cada pago del proveedor se procesa una sola vez
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_payment_id_key
  ON public.subscription_payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
