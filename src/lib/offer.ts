import 'server-only';
import type { UserDoc } from './types';

/**
 * When to offer complimentary credits.
 *
 * Two moments, not one:
 *
 *   FIRST SIGN-IN , the account has never seen it. This is the only time the
 *   offer is an introduction rather than a rescue, and it is why the rule is
 *   not simply "low balance": a brand-new account starts full.
 *
 *   RUNNING LOW , below LOW_CREDIT_MARK credits, whoever they are. The same
 *   number for every account, so the rule can be stated in one line to a
 *   customer or a colleague without first looking up what they were granted.
 *
 * Submitting ends it permanently. Dismissing quiets it for a week, so someone
 * who said "not now" at 20% is not asked again on the next page load, but is
 * reminded if they are still low days later.
 */

/**
 * Show the offer once the balance drops below this.
 *
 * A flat number, deliberately. It was proportional (a fifth of whatever the
 * account was last granted), which warned a 1,000-credit customer at 200 and a
 * free one at 10 , defensible, but it meant nobody could say what the rule was
 * without knowing the account's history. One number is explainable, and 25 is
 * roughly a handful of shoots left, which is the moment the warning is useful.
 */
export const LOW_CREDIT_MARK = 125;

/** Long enough that a dismissal means something, short enough to still help. */
const QUIET_DAYS = 1;

export interface OfferState {
  show: boolean;
  /** Why it is showing , the banner leads with a different line for each. */
  reason: 'welcome' | 'low' | '';
  /** The balance that counts as low for this account, for the copy. */
  mark: number;
}

export function offerState(
  u: Pick<UserDoc, 'balance' | 'offer_seen' | 'offer_submitted'>,
): OfferState {
  const mark = LOW_CREDIT_MARK;

  // Asked and answered. Never again, whatever the balance does.
  if (u.offer_submitted) return { show: false, reason: '', mark };

  if (!u.offer_seen) return { show: true, reason: 'welcome', mark };

  if (Number(u.balance) >= mark) return { show: false, reason: '', mark };

  const since = Date.now() - new Date(u.offer_seen).getTime();
  const quiet = QUIET_DAYS * 24 * 60 * 60 * 1000;
  // A dismissal that cannot be parsed is treated as recent rather than ancient,
  // so bad data quiets the banner instead of pinning it open.
  const waited = Number.isFinite(since) && since > quiet;

  return { show: waited, reason: waited ? 'low' : '', mark };
}
