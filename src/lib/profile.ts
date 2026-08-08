/**
 * The editable part of an account — what the /profile page shows and saves.
 *
 * Deliberately NOT 'server-only': the profile form imports the field list and
 * the state dropdown so the browser and the API agree on what is valid. The
 * server still re-validates everything in `sanitiseProfile` before writing —
 * nothing here is trusted because the client ran it first.
 *
 * The billing fields are not decoration: `gstin` and `state` are snapshotted
 * onto every order, and the state is what decides IGST vs CGST+SGST on the tax
 * invoice (see lib/invoice.ts `isInterState`).
 */

export interface Profile {
  name: string;
  phone: string;
  company: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export const EMPTY_PROFILE: Profile = {
  name: '',
  phone: '',
  company: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
};

/** States and union territories, as GST place-of-supply names. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

/** 22AAAAA0000A1Z5 — state code, PAN, entity number, 'Z', checksum. */
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export const isValidGstin = (s: string): boolean => GSTIN_RE.test(s.toUpperCase().trim());

export function isValidEmail(s: string): boolean {
  const e = s.trim();
  return e.includes('@') && (e.split('@').pop() ?? '').includes('.');
}

const clean = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Coerce a submitted profile into something safe to store.
 *
 * Returns `[profile, null]` or `[null, message]` — the message is shown to the
 * user verbatim, so it says what to fix rather than "invalid input". Optional
 * fields left blank stay blank; only a wrong-looking value is rejected, because
 * refusing to save the whole form over an empty phone number would be absurd.
 */
export function sanitiseProfile(raw: Record<string, unknown>): [Profile, null] | [null, string] {
  const name = clean(raw.name, 80);
  if (!name) return [null, 'Please enter your name.'];

  // Digits, spaces, dashes and a leading + only — a "phone number" with letters
  // in it is a typo, and it ends up on invoices.
  const phone = clean(raw.phone, 20);
  if (phone && !/^\+?[0-9][0-9\s-]{6,18}$/.test(phone)) {
    return [null, 'Enter a valid phone number, or leave it blank.'];
  }

  const gstin = clean(raw.gstin, 15).toUpperCase().replace(/\s/g, '');
  if (gstin && !isValidGstin(gstin)) {
    return [null, 'That GSTIN does not look right. It should be 15 characters, e.g. 27AAACS1234A1Z5.'];
  }

  const state = clean(raw.state, 60);
  if (state && !(INDIAN_STATES as readonly string[]).includes(state)) {
    return [null, 'Choose your state from the list.'];
  }
  // The state is the place of supply; a GSTIN without one leaves the invoice
  // unable to decide IGST vs CGST+SGST, so it has to come as a pair.
  if (gstin && !state) {
    return [null, 'Choose your state as well — it decides how GST is split on your invoice.'];
  }

  const pincode = clean(raw.pincode, 6);
  if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
    return [null, 'Enter a valid 6-digit PIN code, or leave it blank.'];
  }

  return [
    {
      name,
      phone,
      company: clean(raw.company, 80),
      gstin,
      address: String(raw.address ?? '').trim().slice(0, 200),
      city: clean(raw.city, 60),
      state,
      pincode,
    },
    null,
  ];
}