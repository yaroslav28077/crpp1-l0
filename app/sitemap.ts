import type { MetadataRoute } from 'next'
import { getAllNews, getAllPages } from '@/lib/content'
import { archiveHref, archiveYears, countPages } from '@/lib/news-archive'
import { SITE_URL } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const news = getAllNews()
  const pages = getAllPages()

  // Сторінки архіву: розрізи за роками плюс пагінація
  const archive = [
    ...Array.from({ length: countPages(null) - 1 }, (_, i) => archiveHref(null, i + 2)),
    ...archiveYears().flatMap((year) =>
      Array.from({ length: countPages(year) }, (_, i) => archiveHref(year, i + 1)),
    ),
  ]

  return [
    {
      url: SITE_URL,
      lastModified: news[0] ? new Date(news[0].date) : new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/novyny`,
      lastModified: news[0] ? new Date(news[0].date) : new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/komanda`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...archive.map((href) => ({
      url: `${SITE_URL}${href}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
    ...pages.map((p) => ({
      url: `${SITE_URL}/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...news.map((n) => ({
      url: `${SITE_URL}/novyny/${n.slug}`,
      lastModified: new Date(n.date),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    })),
  ]
}
