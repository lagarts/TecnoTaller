import { adminClient, getUserFromReq, activateSubscription, json } from './_lib.js';

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'live';
const API_BASE = PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error('Faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET en Vercel');

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('No se pudo autenticar con PayPal');
  const data = await res.json();
  return data.access_token;
}

// Captura el pago en el servidor y activa la suscripción
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  try {
    const db = adminClient();
    const user = await getUserFromReq(db, req);
    if (!user) return json(res, 401, { error: 'No autenticado' });

    const { orderID } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!orderID) return json(res, 400, { error: 'Falta orderID' });

    const token = await getAccessToken();
    const capRes = await fetch(`${API_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!capRes.ok) {
      const txt = await capRes.text();
      console.error('PayPal capture error:', txt);
      return json(res, 500, { error: 'No se pudo confirmar el pago con PayPal' });
    }

    const order = await capRes.json();
    if (order.status !== 'COMPLETED') {
      return json(res, 200, { ok: false, status: order.status });
    }

    // El pagador debe ser el usuario autenticado (custom_id de la orden)
    const unit = (order.purchase_units || [])[0] || {};
    const ref = unit.custom_id;
    if (ref && ref !== user.id) {
      return json(res, 403, { error: 'La orden no pertenece a este usuario' });
    }

    const result = await activateSubscription(db, {
      userId: user.id,
      provider: 'paypal',
      amount: Number(unit.amount?.value || 10),
      currency: unit.amount?.currency_code || 'USD',
      providerPaymentId: order.id,
    });

    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    console.error('paypal-capture error:', e);
    return json(res, 500, { error: e.message || 'Error interno' });
  }
}
