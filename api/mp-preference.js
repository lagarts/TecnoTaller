import { adminClient, getUserFromReq, json } from './_lib.js';

// Crea una preferencia de Mercado Pago (Checkout Pro) y devuelve la URL de pago
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return json(res, 500, { error: 'MP_ACCESS_TOKEN no está configurado en Vercel' });

    const db = adminClient();
    const user = await getUserFromReq(db, req);
    if (!user) return json(res, 401, { error: 'No autenticado' });

    const APP_URL = process.env.APP_URL || 'https://tecnocovac.vercel.app';

    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [{
          id: 'suscripcion-1-mes',
          title: 'Suscripción TecnoTaller — 1 mes',
          quantity: 1,
          unit_price: 15000,
          currency_id: 'ARS',
        }],
        payer: { email: user.email },
        external_reference: user.id,
        notification_url: `${APP_URL}/api/mp-webhook`,
        back_urls: {
          success: `${APP_URL}/suscripcion?pago=ok`,
          pending: `${APP_URL}/suscripcion?pago=pendiente`,
          failure: `${APP_URL}/suscripcion?pago=fallo`,
        },
        auto_return: 'approved',
        statement_descriptor: 'TECNOTALLER',
        metadata: { user_id: user.id },
      }),
    });

    if (!prefRes.ok) {
      const txt = await prefRes.text();
      console.error('MP preference error:', txt);
      return json(res, 500, { error: 'No se pudo iniciar el pago con Mercado Pago' });
    }

    const pref = await prefRes.json();
    return json(res, 200, { init_point: pref.init_point, id: pref.id });
  } catch (e) {
    console.error('mp-preference error:', e);
    return json(res, 500, { error: e.message || 'Error interno' });
  }
}
