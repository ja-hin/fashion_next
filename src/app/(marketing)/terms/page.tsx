import type { Metadata } from 'next';
import Script from 'next/script';
import LegalShell from '../_components/LegalShell';
import { legalDoc, faqLd } from '@/lib/legal';

export const runtime = 'nodejs';

const doc = legalDoc('terms');

export const metadata: Metadata = {
  title: 'Terms of Use | Faishon Studio',
  description: doc.tagline,
  alternates: { canonical: '/terms' },
};

/**
 * Terms of Use.
 *
 * The wording is lifted verbatim from public/terms.html, which is the
 * reviewed document; see lib/legal.ts for why it is read rather than retyped.
 */
export default function TermsPage() {
  return (
    <>
      <Script
        id="terms-faq-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd(doc)) }}
      />
      <LegalShell doc={doc} />
    </>
  );
}
