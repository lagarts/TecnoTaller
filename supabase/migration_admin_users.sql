-- =============================================
-- Migración: Admin - gestionar usuarios completos
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. Admin puede ACTUALIZAR cualquier perfil (plan, rol, etc.)
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. Admin puede ELIMINAR cualquier perfil
DROP POLICY IF EXISTS "Admin can delete all profiles" ON public.profiles;
CREATE POLICY "Admin can delete all profiles" ON public.profiles FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Admin puede INSERTAR perfiles (para crear usuarios)
DROP POLICY IF EXISTS "Admin can insert all profiles" ON public.profiles;
CREATE POLICY "Admin can insert all profiles" ON public.profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Admin puede gestionar notificaciones (ya existe, se recrea por si acaso)
DROP POLICY IF EXISTS "Admin can manage notifications" ON public.notifications;
CREATE POLICY "Admin can manage notifications" ON public.notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Cualquier usuario autenticado puede VER notificaciones (para la campanita)
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
CREATE POLICY "Users can view notifications" ON public.notifications FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- 6. Función para eliminar un usuario completo de auth.users (cascada borra profile)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que quien llama es admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- No permitir auto-eliminación
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'No podés eliminar tu propia cuenta';
  END IF;

  -- Eliminar de auth.users (cascada borra profiles y demás)
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

-- Dar permiso de ejecución a usuarios autenticados
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 7. Verificar que el perfil del admin existe con rol admin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'covacapp2@gmail.com')
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = 'covacapp2@gmail.com') THEN
    INSERT INTO public.profiles (id, name, email, role)
    SELECT id, 'Administrador', email, 'admin'
    FROM auth.users WHERE email = 'covacapp2@gmail.com';
  END IF;

  -- Asegurar rol admin
  UPDATE public.profiles SET role = 'admin' WHERE email = 'covacapp2@gmail.com';
END $$;