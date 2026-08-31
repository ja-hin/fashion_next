/**
 * The legal pages, read from the authored HTML in /public.
 *
 * Those two files are the source of truth and stay that way: legal copy is
 * reviewed and signed off as a document, and re-typing 30 KB of it into JSX is
 * how a clause quietly loses a "not". So the body copy is lifted verbatim and
 * rendered as HTML — only the chrome (nav, page head, footer) is rebuilt in
 * React, so the pages sit inside the site rather than beside it.
 *
 * Read at module scope: the pages are statically rendered, so this runs once at
 * build and the parsed result is baked into the output.
 */
import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type LegalSlug = 'privacy' | 'terms';

export interface LegalFaq {
  q: string;
  a: string;
}

export interface LegalDoc {
  slug: LegalSlug;
  /** The <h1> — "Privacy Policy". */
  title: string;
  /** The one-line summary under it. */
  tagline: string;
  effective: string;
  updated: string;
  toc: Array<{ href: string; label: string }>;
  /** Sanitised article HTML. */
  body: string;
  faqTitle: string;
  faqSub: string;
  faq: LegalFaq[];
}

/*
 * Even though these files are ours, the body is rendered with
 * dangerouslySetInnerHTML — so it goes through an allowlist first. The point is
 * not that today's file is dangerous; it is that a legal page gets edited by
 * hand, occasionally by pasting from a word processor, and an allowlist means
 * the worst case of that is lost formatting rather than injected script.
 */
const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'span', 'br', 'code',
]);
/** Per-tag attribute allowlist. Anything else — `onclick`, `style` — is dropped. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  h2: new Set(['id']),
  h3: new Set(['id']),
  h4: new Set(['id']),
  span: new Set(['class', 'aria-hidden']),
};

/** Only these schemes survive — no `javascript:`, no `data:`. */
const SAFE_HREF = /^(https?:\/\/|mailto:|\/|#)/i;

function sanitise(html: string): string {
  // Whole elements whose *content* is also unwanted, removed before the rest.
  let out = html.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, '');

  out = out.replace(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g, (_m, close: string, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    // Unknown tag: drop the tag, keep whatever text was inside it.
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (close) return `</${tag}>`;

    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed) return `<${tag}>`;

    const kept: string[] = [];
    const re = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = re.exec(attrs))) {
      const name = a[1].toLowerCase();
      const value = a[2];
      if (!allowed.has(name)) continue;
      if (name === 'href' && !SAFE_HREF.test(value)) continue;
      kept.push(`${name}="${value}"`);
    }
    // Off-site links open away from the page and cannot reach back into it.
    if (tag === 'a') {
      const href = kept.find((k) => k.startsWith('href="'))?.slice(6, -1) ?? '';
      if (/^https?:\/\//i.test(href)) kept.push('target="_blank"', 'rel="noopener noreferrer"');
    }
    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}>`;
  });

  return out.trim();
}

/** Strip every tag — for text that goes into an attribute or a JSON-LD string. */
const text = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Decode the few entities the authored files use. */
const decode = (s: string): string =>
  s
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const between = (html: string, open: string, close: string): string => {
  const a = html.indexOf(open);
  if (a < 0) return '';
  const b = html.indexOf(close, a + open.length);
  return b < 0 ? '' : html.slice(a + open.length, b);
};

const first = (html: string, re: RegExp): string => html.match(re)?.[1] ?? '';

function parse(slug: LegalSlug): LegalDoc {
  const file = path.join(process.cwd(), 'public', `${slug}.html`);
  const html = readFileSync(file, 'utf8');

  const head = between(html, '<div class="pagehead">', '</div>\n\n<div class="shell">') || html;

  /* Both dates are authored as `<div>Effective date<b>…</b></div>`, so the label
     is what tells them apart — the order in the file is not a contract. */
  const dates = [...html.matchAll(/<div>([^<]+)<b>([^<]*)<\/b><\/div>/g)];
  const dated = (label: string) =>
    decode(dates.find(([, l]) => l.toLowerCase().includes(label))?.[2] ?? '');

  const tocHtml = between(html, '<ol>', '</ol>');
  const toc = [...tocHtml.matchAll(/<a href="(#[^"]+)">([\s\S]*?)<\/a>/g)].map(([, href, label]) => ({
    href,
    label: decode(text(label)),
  }));

  const body = sanitise(between(html, '<article>', '</article>'));

  const faqSection = html.match(/<section class="faq"[\s\S]*?<\/section>/)?.[0] ?? '';
  const faq = [...faqSection.matchAll(/<details><summary><span>([\s\S]*?)<\/span>[\s\S]*?<div class="ans">([\s\S]*?)<\/div><\/details>/g)].map(
    ([, q, a]) => ({ q: decode(text(q)), a: sanitise(a) }),
  );

  return {
    slug,
    title: decode(text(first(head, /<h1>([\s\S]*?)<\/h1>/))),
    tagline: decode(text(first(head, /<p class="tagline">([\s\S]*?)<\/p>/))),
    effective: dated('effective'),
    updated: dated('updated'),
    toc,
    body,
    faqTitle: decode(text(first(faqSection, /<h2 class="faqtitle">([\s\S]*?)<\/h2>/))) || 'Frequently asked questions',
    faqSub: decode(text(first(faqSection, /<p class="faqsub">([\s\S]*?)<\/p>/))),
    faq,
  };
}

/** Parsed once per process; the files cannot change under a running build. */
const CACHE = new Map<LegalSlug, LegalDoc>();

export function legalDoc(slug: LegalSlug): LegalDoc {
  let doc = CACHE.get(slug);
  if (!doc) {
    doc = parse(slug);
    CACHE.set(slug, doc);
  }
  return doc;
}

/** Plain-text FAQ pairs, for the FAQPage JSON-LD. */
export const faqLd = (doc: LegalDoc) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: doc.faq.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: text(f.a) },
  })),
});
