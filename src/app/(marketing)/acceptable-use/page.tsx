import type { Metadata } from 'next';
import LegalShell from '../_components/LegalShell';
import { legalDoc } from '@/lib/legal';

export const runtime = 'nodejs';

const doc = legalDoc('acceptable-use');

export const metadata: Metadata = {
  title: 'Acceptable Use Policy | Faishon Studio',
  description: doc.tagline,
  alternates: { canonical: '/acceptable-use' },
};

/**
 * Acceptable Use Policy.
 *
 * The wording is lifted verbatim from public/acceptable-use.html, which is the
 * reviewed document; see lib/legal.ts for why it is read rather than retyped.
 */
export default function AcceptableUsePage() {
  return (
    <LegalShell doc={doc} />
  );
}
