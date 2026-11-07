import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function adminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Faltan variables de entorno: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function json(res, status, data) {
  res.status(status).json(data);
}

export function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// Valida el JWT de Supabase enviado por el frontend (Authorization: Bearer <token>)
export async function getUserFromReq(db, req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Activa la suscripción por 1 mes más (idempotente por provider_payment_id)
export async function activateSubscription(db, { userId, provider, amount, currency, providerPaymentId }) {
  // Si este pago ya se procesó, no duplicar meses
  if (providerPaymentId) {
    const { data: existing } = await db
      .from('subscription_payments')
      .select('id')
      .eq('provider_payment_id', String(providerPaymentId))
      .maybeSingle();
    if (existing) return { already: true };
  }

  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('id, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();
  if (pErr || !profile) throw new Error(`Perfil no encontrado: ${userId}`);

  // Suma 1 mes desde la fecha vigente (si está vencida, desde hoy)
  let base = new Date();
  if (profile.trial_ends_at) {
    const t = new Date(profile.trial_ends_at);
    if (t > base) base = t;
  }
  const nuevo = new Date(base);
  nuevo.setMonth(nuevo.getMonth() + 1);

  const { error: uErr } = await db
    .from('profiles')
    .update({
      subscription_plan: 'pro',
      subscription_active: true,
      trial_ends_at: nuevo.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (uErr) throw new Error(`Error actualizando perfil: ${uErr.message}`);

  const { error: iErr } = await db.from('subscription_payments').insert({
    user_id: userId,
    method: provider,
    amount,
    currency,
    status: 'aprobado',
    provider_payment_id: String(providerPaymentId),
    reviewed_at: new Date().toISOString(),
    notes: 'Pago automático',
  });
  // 23505 = carrera concurrente, ya se registró — no es error
  if (iErr && iErr.code !== '23505') console.error('Error registrando pago:', iErr);

  return { activated: true, until: nuevo.toISOString() };
}
