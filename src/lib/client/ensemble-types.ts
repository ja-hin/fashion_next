'use client';

import type { RefRole } from '@/lib/ensemble';

/**
 * One tagged product image in an ensemble, as the browser holds it.
 *
 * Array order is the manifest — the hero prompt numbers these "Image 1",
 * "Image 2"… — so reordering the list changes which item goes where on the
 * model. Add and remove, never sort.
 */
export interface EnsembleRef {
  file: File;
  role: RefRole;
  /** Object URL for the thumbnail. Revoke it when the ref is dropped. */
  url: string;
  /**
   * True while the classifier is still looking at this image. Until it clears
   * there is no role to show — the stored one is only a placeholder, and
   * displaying it would present a guess the app has not actually made.
   */
  detecting?: boolean;
  /** True when auto-detect was unsure, so the UI can ask for a confirmation. */
  unsure?: boolean;
  /** Auto-detect certainty, 0–1. Undefined once the user has picked by hand. */
  confidence?: number;
  /** What the detector says it saw — shown under the role so a wrong guess is obvious. */
  reason?: string;
}
