import { handler, json } from '@/lib/api';
import { getMePayload } from '@/lib/me';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => json(await getMePayload()));
