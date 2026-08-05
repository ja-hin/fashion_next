import { handler, json, HttpError } from '@/lib/api';
import {
  verifyWebhookSignature,
  creditOrder,
  failOrder,
  WEBHOOK_CONFIGURED,
} from '@/lib/razorpay';

export const runtime = 'nodejs';
// The signature is computed over the exact bytes Razorpay sent, so this route
// must never be statically optimised or have its body re-encoded.
export const dynamic = 'force-dynamic';

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        error_description?: string;
        error_reason?: string;
      };
    };
  };
}

/**
 * Razorpay webhook — the authoritative confirmation path.
 *
 * The browser-side verify route is best-effort: a user who pays and closes the
 * tab before the callback fires would never be credited without this. Razorpay
 * retries a webhook that doesn't return 2xx, so every path here either succeeds
 * or fails loudly rather than swallowing an error.
 *
 * Unauthenticated by necessity — Razorpay has no session. The HMAC over the raw
 * body IS the authentication, which is why the secret must be set for this
 * route to accept anything at all.
 */
export const POST = handler(async (req: Request) => {
  if (!WEBHOOK_CONFIGURED) {
    console.error('[razorpay] webhook hit but RAZORPAY_WEBHOOK_SECRET is unset — rejecting');
    throw new HttpError(503, 'Webhook not configured.');
  }

  // Raw text, not req.json() — re-serialising changes byte order and the HMAC
  // would never match.
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!verifyWebhookSignature(raw, signature)) {
    console.error('[razorpay] webhook signature mismatch — ignoring');
    throw new HttpError(400, 'Invalid signature.');
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    throw new HttpError(400, 'Malformed webhook payload.');
  }

  const entity = body.payload?.payment?.entity;
  const orderId = entity?.order_id ?? '';
  const paymentId = entity?.id ?? '';

  switch (body.event) {
    case 'payment.captured': {
      if (!orderId || !paymentId) throw new HttpError(400, 'Payment event missing ids.');
      const r = await creditOrder(orderId, paymentId, 'webhook');
      // credited=false here is the normal case when Checkout already confirmed
      // it — not an error, so still a 200.
      console.log(
        `[razorpay] payment.captured order=${orderId} payment=${paymentId} credited=${r.credited}`,
      );
      return json({ ok: true, credited: r.credited });
    }

    case 'payment.failed': {
      if (orderId) {
        await failOrder(orderId, entity?.error_description ?? entity?.error_reason ?? 'failed');
      }
      console.log(`[razorpay] payment.failed order=${orderId || '-'} payment=${paymentId || '-'}`);
      return json({ ok: true });
    }

    default:
      // Unsubscribed events still get a 200 — a non-2xx makes Razorpay retry
      // something we were never going to act on.
      return json({ ok: true, ignored: body.event ?? null });
  }
});