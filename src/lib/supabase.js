import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Cliente temporal para crear cuentas (no persiste sesión, así no cierra la del dueño)
export async function createAuthUser({ email, password, name, role = 'worker' }) {
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: { data: { name, role } },
  })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'No se pudo crear el usuario' }
  // Si el email ya existe, Supabase devuelve user sin identities
  if (data.user.identities && data.user.identities.length === 0) {
    return { error: 'Este email ya está registrado' }
  }

  const userId = data.user.id

  // Asegurar que el perfil exista con rol worker (por si no hay trigger)
  if (data.session) {
    await tempClient.from('profiles').upsert(
      { id: userId, name, email, role },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  }

  return { userId }
}
