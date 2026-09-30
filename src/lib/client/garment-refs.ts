'use client';

import type { PublicGarment } from '@/lib/types';
import type { EnsembleRef } from './ensemble-types';

/**
 * Pull a saved garment back into ordinary tagged references.
 *
 * A saved garment is deliberately not a special read-only thing: its images
 * become real File refs, so the tagging window opens on them exactly as it
 * would on a fresh upload and every angle can be reviewed, retagged, added to
 * or dropped before a credit is spent.
 *
 * They arrive already tagged, so they are marked confident , the window must
 * not re-run detection over work that was done when the garment was saved, and
 * a fresh guess could overwrite a correct hand-tag with a worse one.
 */
export async function garmentToRefs(g: PublicGarment): Promise<EnsembleRef[]> {
  return Promise.all(
    g.refs.map(async (r) => {
      const res = await fetch(r.url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Could not read a saved image');
      const blob = await res.blob();
      const file = new File([blob], r.file, { type: blob.type || 'image/jpeg' });
      return {
        file,
        role: r.role,
        url: URL.createObjectURL(file),
        detecting: false,
        unsure: false,
        confidence: 1,
        reason: `from "${g.name}"`,
      };
    }),
  );
}

/**
 * Pull a finished shoot's ORIGINAL uploads back into tagged references.
 *
 * The same trick as garmentToRefs , fetch, blob, File , and for the same
 * reason: a reshoot must start from real editable refs, so the tagging window
 * opens on them and every angle can be retagged, added to or dropped before a
 * credit is spent.
 *
 * Marked confident, because these were tagged when the first shoot ran.
 * Re-detecting would spend a call to second-guess a decision already made, and
 * could overwrite a correct hand-tag with a worse guess.
 */
export async function shootSourceToRefs(
  refs: Array<{ file: string; role: string; url: string }>,
  shootLabel: string,
): Promise<EnsembleRef[]> {
  return Promise.all(
    refs.map(async (r) => {
      const res = await fetch(r.url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Could not read an image from that shoot');
      const blob = await res.blob();
      const file = new File([blob], r.file, { type: blob.type || 'image/jpeg' });
      return {
        file,
        role: r.role as EnsembleRef['role'],
        url: URL.createObjectURL(file),
        detecting: false,
        unsure: false,
        confidence: 1,
        reason: `from ${shootLabel}`,
      };
    }),
  );
}
