import { handler, json, HttpError } from '@/lib/api';
import { createLead, LeadError } from '@/lib/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The marketing page's contact form.
 *
 * Unauthenticated by necessity , the whole point is to hear from people who do
 * not have an account. That makes it the one write endpoint a stranger can
 * reach, so it carries two cheap defences instead of one expensive one:
 *
 *   1. A honeypot field, hidden in CSS and left empty by every human. Bots fill
 *      every input they find, so a non-empty `company_website` is a bot with
 *      near-certainty. It is answered with a 200 and dropped on the floor: an
 *      error would tell whoever wrote the bot which field gave them away.
 *   2. A per-IP throttle, below.
 *
 * Neither is airtight. Together they cost nothing and stop the drive-by traffic
 * a public form actually gets. If this ever needs to hold against someone
 * trying, the answer is a captcha, not a stricter regex.
 */

/** Enquiries per IP per window. Generous: a person who sends two is not a bot. */
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60_000;

/*
 * In-memory, so it resets on deploy and is per-instance rather than global.
 * That is a real limit and worth being honest about , it is a speed bump for
 * casual flooding, not a rate limiter. Anything stronger belongs in Redis or at
 * the edge, and neither is worth standing up for a contact form.
 */
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Old IPs are swept here rather than on a timer: a map that only ever grows
  // is a leak, and a request is the only moment this module is awake.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

/** Best-effort client address; every value here is a header the client can set. */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  return (fwd.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

export const POST = handler(async (req: Request) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'Expected a JSON body');
  }

  // Answered as though it worked. See the honeypot note above.
  if (String(body.company_website ?? '').trim()) return json({ ok: true });

  if (throttled(clientIp(req))) {
    throw new HttpError(429, 'That is a few too many , please email us directly.');
  }

  try {
    const lead = await createLead(body);
    // Nothing about the stored record goes back: the visitor already knows what
    // they typed, and an id would only be useful to someone enumerating them.
    return json({ ok: true, name: lead.name });
  } catch (e) {
    if (e instanceof LeadError) throw new HttpError(400, e.message);
    throw e;
  }
});
