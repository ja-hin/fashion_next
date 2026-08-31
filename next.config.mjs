/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp + mongodb are native/server-only — keep them out of the bundler so
  // Next doesn't try to trace or inline their binaries into route bundles.
  serverExternalPackages: ['sharp', 'mongodb', '@google/genai'],

  // Generation posts a garment image; the default 1 MB server-action body limit
  // doesn't apply to route handlers, but keep uploads sane at the proxy layer too.
  experimental: {
    largePageDataBytes: 8 * 1024 * 1024,
  },

  // Long-running generation happens in-process (see src/lib/jobs.ts), so the app
  // must run as ONE real Node server (`next start` behind nginx), never in an
  // edge/serverless runtime and never clustered across workers — a poll could
  // otherwise land on a process that has never heard of the job. Every
  // generation route pins `runtime = 'nodejs'` explicitly.

  // Back-compat: the app used to be one page at /app with #hash views. Anything
  // bookmarked or linked from the old marketing copy still lands correctly.
  async redirects() {
    return [
      { source: '/app', destination: '/generate', permanent: false },
      { source: '/home', destination: '/', permanent: false },
      { source: '/signup', destination: '/register', permanent: false },

      // The legal copy is authored as standalone files in /public, which the
      // app also serves verbatim at these URLs. Two live URLs for one document
      // is duplicate content to a crawler and two different-looking pages to a
      // reader, so the file paths point at the real pages. `redirects()` runs
      // ahead of static file serving, so these win.
      { source: '/privacy.html', destination: '/privacy', permanent: true },
      { source: '/terms.html', destination: '/terms', permanent: true },
      { source: '/acceptable-use.html', destination: '/acceptable-use', permanent: true },
    ];
  },

  poweredByHeader: false,
};

export default nextConfig;