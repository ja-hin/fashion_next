import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { checkPassword, changeEmail, updateProfile } from '@/lib/auth';
import { sanitiseProfile, isValidEmail, type Profile } from '@/lib/profile';
import type { UserDoc } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Everything the profile page renders — never the password hash or salt. */
function view(u: UserDoc): Profile & {
  uid: string;
  email: string;
  created: string;
  balance: number;
  admin: boolean;
} {
  return {
    uid: u.uid ?? '',
    email: u.email,
    created: u.created ?? '',
    balance: Number(u.balance ?? 0),
    admin: !!u.is_admin,
    name: u.name ?? '',
    phone: u.phone ?? '',
    company: u.company ?? '',
    gstin: u.gstin ?? '',
    address: u.address ?? '',
    city: u.city ?? '',
    state: u.state ?? '',
    pincode: u.pincode ?? '',
  };
}

export const GET = handler(async () => json(view(await requireUser())));

/**
 * Save the profile.
 *
 * Only the fields a user owns are writable — balance, role and active status
 * are admin territory and are simply not read from the body, so a crafted form
 * post can't grant itself credits.
 */
export const PATCH = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const [profile, err] = sanitiseProfile({
    name: str(fd, 'name'),
    phone: str(fd, 'phone'),
    company: str(fd, 'company'),
    gstin: str(fd, 'gstin'),
    address: str(fd, 'address'),
    city: str(fd, 'city'),
    state: str(fd, 'state'),
    pincode: str(fd, 'pincode'),
  });
  if (!profile) throw new HttpError(400, err);

  // Changing the sign-in address is re-authenticated: a borrowed session left
  // open on someone's desk must not be able to move the account to a new
  // address and lock the owner out via password reset.
  const email = str(fd, 'email').toLowerCase().trim();
  if (email && email !== me.email) {
    if (!isValidEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (!checkPassword(me, str(fd, 'password'))) {
      throw new HttpError(403, 'Enter your current password to change your email address.');
    }
    if (!(await changeEmail(me._id, email))) {
      throw new HttpError(409, 'An account with this email already exists.');
    }
  }

  await updateProfile(me._id, profile);
  return json(view(await requireUser()));
});