import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NewsArchive } from '@/components/news-archive'
import { archiveHref, archiveYears, getArchiveView } from '@/lib/news-archive'

export function generateStaticParams() {
  return archiveYears().map((rik) => ({ rik }))
}

export async function generateMetadata({ params }: { params: Promise<{ rik: string }> }): Promise<Metadata> {
  const { rik } = await params
  return {
    title: `Новини за ${rik} рік`,
    description: `Публікації Центру професійного розвитку педагогічних працівників м. Лубни за ${rik} рік`,
    alternates: { canonical: archiveHref(rik, 1) },
  }
}

export default async function NewsYearPage({ params }: { params: Promise<{ rik: string }> }) {
  const { rik } = await params
  if (!archiveYears().includes(rik)) notFound()

  return <NewsArchive view={getArchiveView(rik, 1)} />
}
