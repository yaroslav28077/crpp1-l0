import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NewsArchive } from '@/components/news-archive'
import { archiveHref, archiveYears, countPages, getArchiveView } from '@/lib/news-archive'

export function generateStaticParams() {
  // Перша сторінка року живе на /novyny/rik/<рік>, тут лише друга й далі
  return archiveYears().flatMap((rik) =>
    Array.from({ length: countPages(rik) - 1 }, (_, i) => ({ rik, storinka: String(i + 2) })),
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rik: string; storinka: string }>
}): Promise<Metadata> {
  const { rik, storinka } = await params
  return {
    title: `Новини за ${rik} рік — сторінка ${storinka}`,
    description: `Публікації Центру професійного розвитку педагогічних працівників м. Лубни за ${rik} рік`,
    alternates: { canonical: archiveHref(rik, Number.parseInt(storinka, 10) || 1) },
  }
}

export default async function NewsYearPagePaginated({
  params,
}: {
  params: Promise<{ rik: string; storinka: string }>
}) {
  const { rik, storinka } = await params
  const page = Number.parseInt(storinka, 10)
  if (!archiveYears().includes(rik)) notFound()
  if (!Number.isInteger(page) || page < 2 || page > countPages(rik)) notFound()

  return <NewsArchive view={getArchiveView(rik, page)} />
}
