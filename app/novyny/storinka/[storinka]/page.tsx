import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NewsArchive } from '@/components/news-archive'
import { archiveHref, countPages, getArchiveView } from '@/lib/news-archive'

export function generateStaticParams() {
  // Перша сторінка живе на /novyny, тут лише друга й далі
  return Array.from({ length: countPages(null) - 1 }, (_, i) => ({ storinka: String(i + 2) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storinka: string }>
}): Promise<Metadata> {
  const { storinka } = await params
  return {
    title: `Новини — сторінка ${storinka}`,
    description: 'Новини Центру професійного розвитку педагогічних працівників м. Лубни',
    alternates: { canonical: archiveHref(null, Number.parseInt(storinka, 10) || 1) },
  }
}

export default async function NewsPagePaginated({
  params,
}: {
  params: Promise<{ storinka: string }>
}) {
  const { storinka } = await params
  const page = Number.parseInt(storinka, 10)
  if (!Number.isInteger(page) || page < 2 || page > countPages(null)) notFound()

  return <NewsArchive view={getArchiveView(null, page)} />
}
