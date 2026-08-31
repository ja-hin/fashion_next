import type { Metadata } from 'next';
import LegalShell from '../_components/LegalShell';
import { legalDoc } from '@/lib/legal';

export const runtime = 'nodejs';

const doc = legalDoc('privacy');

export const metadata: Metadata = {
  title: 'Privacy Policy | Faishon Studio',
  description: doc.tagline,
  alternates: { canonical: '/privacy' },
};

/**
 * Privacy Policy.
 *
 * The wording is lifted verbatim from public/privacy.html, which is the
 * reviewed document; see lib/legal.ts for why it is read rather than retyped.
 */
export default function PrivacyPage() {
  return (
    <LegalShell doc={doc} />
  );
}
