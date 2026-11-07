import { adminClient, getUserFromReq, json } from './_lib.js';

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

// Crea una orden de PayPal por US$10 y devuelve el link de aprobación
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  try {
    const db = adminClient();
    const user = await getUserFromReq(db, req);
    if (!user) return json(res, 401, { error: 'No autenticado' });

    const token = await getAccessToken();
    const APP_URL = process.env.APP_URL || 'https://tecnocovac.vercel.app';

    const orderRes = await fetch(`${API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: '10.00' },
          description: 'Suscripción TecnoTaller — 1 mes',
          custom_id: user.id,
        }],
        application_context: {
          brand_name: 'TecnoTaller',
          return_url: `${APP_URL}/suscripcion?pago=ok`,
          cancel_url: `${APP_URL}/suscripcion?pago=fallo`,
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!orderRes.ok) {
      const txt = await orderRes.text();
      console.error('PayPal create order error:', txt);
      return json(res, 500, { error: 'No se pudo iniciar el pago con PayPal' });
    }

    const order = await orderRes.json();
    const approveLink = (order.links || []).find(l => l.rel === 'approve')?.href;
    if (!approveLink) return json(res, 500, { error: 'PayPal no devolvió link de pago' });

    return json(res, 200, { id: order.id, approve_link: approveLink });
  } catch (e) {
    console.error('paypal-create-order error:', e);
    return json(res, 500, { error: e.message || 'Error interno' });
  }
}
