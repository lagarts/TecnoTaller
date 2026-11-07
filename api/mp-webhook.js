import { adminClient, activateSubscription, safeParse, json } from './_lib.js';

// Webhook de Mercado Pago: recibe notificaciones de pago y activa la suscripción
export default async function handler(req, res) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return json(res, 500, { error: 'MP_ACCESS_TOKEN no configurado' });

    // MP puede avisar por GET (?topic=payment&id=...) o por POST ({type:'payment',data:{id}})
    let paymentId = null;
    if (req.method === 'GET') {
      paymentId = req.query?.id || req.query?.['data.id'] || null;
      const topic = req.query?.topic || req.query?.type;
      if (topic && topic !== 'payment' && topic !== 'merchant_order') {
        return json(res, 200, { ok: true, ignored: true });
      }
    } else if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
      if (!body) return json(res, 200, { ok: true, ignored: true });
      if (body.type === 'payment' || body.topic === 'payment') {
        paymentId = body.data?.id || body['data.id'] || null;
      } else {
        // merchant_order u otros temas: si trae id de pago lo seguimos, si no ignoramos
        paymentId = body.data?.id || null;
        if (!paymentId) return json(res, 200, { ok: true, ignored: true });
      }
    } else {
      return json(res, 405, { error: 'Método no permitido' });
    }

    if (!paymentId) return json(res, 200, { ok: true, ignored: true });

    // Consultamos el pago real en la API de MP (nunca confiamos solo en el aviso)
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!payRes.ok) {
      console.error('MP payment fetch error:', payRes.status, await payRes.text());
      // Respondemos 200 para que MP no reenvíe en loop por errores transitorios
      return json(res, 200, { ok: false, reason: 'payment_fetch_failed' });
    }
    const payment = await payRes.json();

    if (payment.status !== 'approved') {
      return json(res, 200, { ok: true, status: payment.status });
    }

    const userId = payment.external_reference;
    if (!userId) {
      console.error('MP payment sin external_reference:', paymentId);
      return json(res, 200, { ok: true, reason: 'no_reference' });
    }

    const db = adminClient();
    const result = await activateSubscription(db, {
      userId,
      provider: 'mercadopago',
      amount: payment.transaction_amount,
      currency: payment.currency_id || 'ARS',
      providerPaymentId: payment.id,
    });

    return json(res, 200, { ok: true, ...result });
  } catch (e) {
    console.error('mp-webhook error:', e);
    // 200 para evitar reintentos en loop; el error queda en logs
    return json(res, 200, { ok: false, error: e.message });
  }
}
