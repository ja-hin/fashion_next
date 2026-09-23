import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://faishon.studio/',
      lastModified: new Date('2026-09-15'),
      priority: 1,
    },
    {
      url: 'https://faishon.studio/terms',
      lastModified: new Date('2026-09-15'),
      priority: 0.3,
    },
    {
      url: 'https://faishon.studio/privacy',
      lastModified: new Date('2026-09-15'),
      priority: 0.3,
    },
    {
      url: 'https://faishon.studio/acceptable-use',
      lastModified: new Date('2026-09-15'),
      priority: 0.3,
    },
  ]
}