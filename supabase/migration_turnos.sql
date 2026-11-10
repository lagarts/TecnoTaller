-- =============================================
-- Migración: Sistema de Turnos
-- Portal de clientes (DNI + contraseña) para
-- reservar turnos, ver historial y servicios
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Clientes del portal (registro único con DNI + contraseña)
CREATE TABLE IF NOT EXISTS public.portal_clients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dni TEXT UNIQUE NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vehículos del cliente (varios por cuenta)
CREATE TABLE IF NOT EXISTS public.portal_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.portal_clients(id) ON DELETE CASCADE,
  patente TEXT UNIQUE NOT NULL,
  brand TEXT DEFAULT '',
  model TEXT DEFAULT '',
  year INTEGER,
  color TEXT DEFAULT '',
  km INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Turnos / reservas
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.portal_clients(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.portal_vehicles(id) ON DELETE SET NULL,
  appt_date DATE NOT NULL,
  appt_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'confirmado', 'cancelado', 'completado')),
  reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  -- Reserva manual del mecánico sin cliente registrado:
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  patente TEXT DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'cliente' CHECK (created_by IN ('cliente', 'taller')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo turno activo por fecha+hora (evita doble reserva)
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_unique
  ON public.appointments (appt_date, appt_time)
  WHERE status IN ('pendiente', 'confirmado');

CREATE INDEX IF NOT EXISTS appointments_date_idx ON public.appointments (appt_date);
CREATE INDEX IF NOT EXISTS appointments_client_idx ON public.appointments (client_id);

-- 4. Registros de servicio (lo que hizo el taller + lo que agrega el cliente de otro lugar)
CREATE TABLE IF NOT EXISTS public.service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.portal_vehicles(id) ON DELETE CASCADE,
  origin TEXT NOT NULL DEFAULT 'taller' CHECK (origin IN ('taller', 'externo')),
  service_date DATE NOT NULL,
  km INTEGER,
  description TEXT NOT NULL,
  price NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES public.portal_clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_records_vehicle_idx ON public.service_records (vehicle_id);

-- =============================================
-- HELPERS
-- =============================================

-- ¿El usuario logueado es staff del taller (admin o mecánico)?
CREATE OR REPLACE FUNCTION public.is_workshop_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'worker'));
$$;

REVOKE ALL ON FUNCTION public.is_workshop_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workshop_staff() TO anon, authenticated;

-- ¿Ya existe una cuenta con ese DNI? (para el registro anónimo)
CREATE OR REPLACE FUNCTION public.portal_dni_exists(p_dni TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM portal_clients WHERE dni = p_dni);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_dni_exists(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_dni_exists(TEXT) TO anon, authenticated;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.portal_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

-- portal_clients
DROP POLICY IF EXISTS "Client sees own profile" ON public.portal_clients;
CREATE POLICY "Client sees own profile" ON public.portal_clients
  FOR SELECT USING (auth.uid() = id OR public.is_workshop_staff());

DROP POLICY IF EXISTS "Client inserts own profile" ON public.portal_clients;
CREATE POLICY "Client inserts own profile" ON public.portal_clients
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Client updates own profile" ON public.portal_clients;
CREATE POLICY "Client updates own profile" ON public.portal_clients
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff updates clients" ON public.portal_clients;
CREATE POLICY "Staff updates clients" ON public.portal_clients
  FOR UPDATE USING (public.is_workshop_staff());

-- portal_vehicles
DROP POLICY IF EXISTS "Client manages own vehicles" ON public.portal_vehicles;
CREATE POLICY "Client manages own vehicles" ON public.portal_vehicles
  FOR ALL USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Staff manages all vehicles" ON public.portal_vehicles;
CREATE POLICY "Staff manages all vehicles" ON public.portal_vehicles
  FOR ALL USING (public.is_workshop_staff());

-- appointments
DROP POLICY IF EXISTS "Client sees own appointments" ON public.appointments;
CREATE POLICY "Client sees own appointments" ON public.appointments
  FOR SELECT USING (client_id = auth.uid() OR public.is_workshop_staff());

DROP POLICY IF EXISTS "Client books own appointment" ON public.appointments;
CREATE POLICY "Client books own appointment" ON public.appointments
  FOR INSERT WITH CHECK (
    public.is_workshop_staff()
    OR (
      client_id = auth.uid()
      AND created_by = 'cliente'
      AND status = 'pendiente'
      AND vehicle_id IN (SELECT id FROM public.portal_vehicles WHERE client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Client cancels own appointment" ON public.appointments;
CREATE POLICY "Client cancels own appointment" ON public.appointments
  FOR UPDATE USING (
    client_id = auth.uid() AND status IN ('pendiente', 'confirmado')
  ) WITH CHECK (
    client_id = auth.uid() AND status = 'cancelado'
  );

DROP POLICY IF EXISTS "Staff manages appointments" ON public.appointments;
CREATE POLICY "Staff manages appointments" ON public.appointments
  FOR ALL USING (public.is_workshop_staff()) WITH CHECK (public.is_workshop_staff());

DROP POLICY IF EXISTS "Staff deletes appointments" ON public.appointments;
CREATE POLICY "Staff deletes appointments" ON public.appointments
  FOR DELETE USING (public.is_workshop_staff());

-- service_records
DROP POLICY IF EXISTS "Client sees records of own vehicles" ON public.service_records;
CREATE POLICY "Client sees records of own vehicles" ON public.service_records
  FOR SELECT USING (
    vehicle_id IN (SELECT id FROM public.portal_vehicles WHERE client_id = auth.uid())
    OR public.is_workshop_staff()
  );

DROP POLICY IF EXISTS "Client adds external records" ON public.service_records;
CREATE POLICY "Client adds external records" ON public.service_records
  FOR INSERT WITH CHECK (
    public.is_workshop_staff()
    OR (
      origin = 'externo'
      AND created_by = auth.uid()
      AND vehicle_id IN (SELECT id FROM public.portal_vehicles WHERE client_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Client edits own external records" ON public.service_records;
CREATE POLICY "Client edits own external records" ON public.service_records
  FOR UPDATE USING (
    public.is_workshop_staff() OR (created_by = auth.uid() AND origin = 'externo')
  ) WITH CHECK (
    public.is_workshop_staff() OR (created_by = auth.uid() AND origin = 'externo')
  );

DROP POLICY IF EXISTS "Client deletes own external records" ON public.service_records;
CREATE POLICY "Client deletes own external records" ON public.service_records
  FOR DELETE USING (
    public.is_workshop_staff() OR (created_by = auth.uid() AND origin = 'externo')
  );

-- =============================================
-- GRANTS (explícitos por si los defaults no aplican)
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.portal_clients, public.portal_vehicles,
  public.appointments, public.service_records
TO authenticated;

REVOKE ALL ON
  public.portal_clients, public.portal_vehicles,
  public.appointments, public.service_records
FROM anon;

-- =============================================
-- TRIGGER: los clientes del portal NO generan
-- perfil en la app del taller
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'kind', '') = 'portal' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
