-- =============================================
-- Migración: columnas faltantes en vehicles
-- Ejecutar en Supabase SQL Editor
-- =============================================

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT '';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS chasis_number TEXT DEFAULT '';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS cc INTEGER;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS insurance TEXT DEFAULT '';

-- El dominio (patente) debe permitir valores únicos por usuario
-- (ya existe UNIQUE sobre patente, se mantiene)