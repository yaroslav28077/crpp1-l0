import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // без кінцевого слеша, щоб покрити і /admin, і /admin/*
      disallow: ['/admin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
