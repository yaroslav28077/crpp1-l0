import { getAllCertificates, getCertificateBySlug } from '@/lib/content'
import { buildCertificateCsv } from '@/lib/certificates-csv'

/**
 * Файл переліку для Excel. Збирається під час білду разом зі сторінками, тож
 * на Netlify це звичайний статичний файл — без функцій і без затримки.
 */
export const dynamic = 'force-static'

export function generateStaticParams() {
  return getAllCertificates().map((c) => ({ slug: c.slug }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = getCertificateBySlug(slug)
  if (!item) return new Response('Перелік не знайдено', { status: 404 })

  return new Response(buildCertificateCsv(item), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // Ім'я файлу латиницею: кирилиця в цьому заголовку ламається в частині браузерів
      'Content-Disposition': `attachment; filename="perelik-${slug}.csv"`,
    },
  })
}
