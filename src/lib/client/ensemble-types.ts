'use client';

import type { RefRole } from '@/lib/ensemble';

/**
 * One tagged product image in an ensemble, as the browser holds it.
 *
 * Array order is the manifest , the hero prompt numbers these "Image 1",
 * "Image 2"… , so reordering the list changes which item goes where on the
 * model. Add and remove, never sort.
 */
export interface EnsembleRef {
  file: File;
  role: RefRole;
  /** Object URL for the thumbnail. Revoke it when the ref is dropped. */
  url: string;
  /**
   * True while the classifier is still looking at this image. Until it clears
   * there is no role to show , the stored one is only a placeholder, and
   * displaying it would present a guess the app has not actually made.
   */
  detecting?: boolean;
  /** True when auto-detect was unsure, so the UI can ask for a confirmation. */
  unsure?: boolean;
  /** Auto-detect certainty, 0–1. Undefined once the user has picked by hand. */
  confidence?: number;
  /** What the detector says it saw , shown under the role so a wrong guess is obvious. */
  reason?: string;
  /**
   * The classifier read this as intimate apparel.
   *
   * The image model refuses to dress a figure in it, so the shoot is stopped
   * here instead , before a credit is spent on a frame that comes back unusable.
   */
  restricted?: boolean;

  /*
   * Everything below comes from the same detect call , see ATTRIBUTES_RULE in
   * api/ensemble/detect. All optional and all safe to ignore: nothing in the
   * shoot path reads them yet, they are returned so their accuracy can be
   * judged on real uploads before anything is wired to depend on them.
   *
   * '' consistently means "not visible in this photo", never "not asked".
   */

  /** One of the app's own category ids, so it can prefill the dropdown. */
  category?: string;
  /** female | male | child | unisex */
  gender?: string;
  /** The specific item, 1-3 words , "banarasi saree", not "top". */
  garment_type?: string;
  colour?: string;
  colour_secondary?: string;
  fabric?: string;
  pattern?: string;
  sleeve_length?: string;
  neckline?: string;
  fit?: string;
  length?: string;
  occasion?: string;
  /** Someone is wearing or holding it , the "Extend" input family's signal. */
  has_person?: boolean;
  /** Flat or on a ghost mannequin, nobody in frame. */
  is_flat_lay?: boolean;
  /** One visible problem with the photo, or '' when it is clean. */
  quality_issue?: string;
  /** Names the item when `restricted`, so the block message can be specific. */
  restricted_reason?: string;

  /**
   * What to do about a photo that has a person in it , chosen by the user in
   * the Special Category desk's "there is a person in this photo" modal.
   *
   * 'own'     , they are supplying a garment-only image themselves, and have.
   * 'extract' , we pull the garment out of this photo for them.
   *
   * Undefined means the question has not been put to them yet. That is what
   * stops the modal re-opening on an image they have already answered for.
   */
  garment_plan?: 'own' | 'extract';
  /**
   * True while /api/ensemble/extract is pulling the garment out of this photo.
   *
   * Separate from `detecting`: that one means "we do not know what this is yet",
   * this one means "the picture itself is about to be replaced". They can be
   * false at the same time for different refs in one set.
   */
  extracting?: boolean;
}
