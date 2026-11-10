import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cliente SEPARADO para el portal de clientes.
// Usa otro storageKey para no pisar la sesión del taller en el mismo navegador.
export const portalClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-portal-auth-token',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Supabase Auth necesita un email: usamos el DNI como base
const emailFor = (dni) => `${dni}@turnos.tecnotaller.app`;

export async function portalRegister({ dni, name, phone, password }) {
  const { data: exists, error: rpcErr } = await portalClient.rpc('portal_dni_exists', { p_dni: dni });
  if (rpcErr) return { error: 'No se pudo verificar el DNI. Intentá de nuevo.' };
  if (exists) return { error: 'Ya existe una cuenta con ese DNI. Iniciá sesión.' };

  const { data, error } = await portalClient.auth.signUp({
    email: emailFor(dni),
    password,
    options: { data: { kind: 'portal', name, phone } },
  });
  if (error) return { error: translateAuthError(error.message) };
  if (!data.user) return { error: 'No se pudo crear la cuenta' };
  // Email ya registrado: Supabase devuelve user sin identities
  if (data.user.identities && data.user.identities.length === 0) {
    return { error: 'Ya existe una cuenta con ese DNI. Iniciá sesión.' };
  }

  // Si la cuenta no se confirmó sola, intentamos entrar para poder insertar el perfil
  if (!data.session) {
    const login = await portalLogin({ dni, password });
    if (login.error) return { error: 'No se pudo iniciar sesión. Revisá tu contraseña.' };
  }

  const { error: insErr } = await portalClient.from('portal_clients').insert({
    id: data.user.id,
    dni,
    name: name || '',
    phone: phone || '',
  });
  if (insErr) {
    if (insErr.code === '23505') return { error: 'Ya existe una cuenta con ese DNI. Iniciá sesión.' };
    return { error: 'No se pudo completar el registro: ' + insErr.message };
  }
  return { user: data.user };
}

export async function portalLogin({ dni, password }) {
  const { data, error } = await portalClient.auth.signInWithPassword({
    email: emailFor(dni),
    password,
  });
  if (error) {
    return {
      error: error.message === 'Invalid login credentials'
        ? 'DNI o contraseña incorrectos'
        : translateAuthError(error.message),
    };
  }
  return { user: data.user };
}

export async function portalLogout() {
  await portalClient.auth.signOut();
}

export async function portalSession() {
  const { data } = await portalClient.auth.getSession();
  return data.session;
}

function translateAuthError(msg) {
  if (!msg) return 'Error inesperado';
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('rate limit') || msg.includes('security purposes')) {
    return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
  }
  if (msg.includes('already registered')) return 'Ya existe una cuenta con ese DNI';
  return msg;
}
