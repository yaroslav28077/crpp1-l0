import type { Metadata } from 'next'
import { NewsArchive } from '@/components/news-archive'
import { getArchiveView } from '@/lib/news-archive'

export const metadata: Metadata = {
  title: 'Новини',
  description: 'Новини Центру професійного розвитку педагогічних працівників м. Лубни',
  // Редиректи зі старих адрес зберігають query-параметри (/novyny/rik/2024?rik=2024),
  // тож канонічна адреса потрібна, щоб пошуковики не бачили дублів
  alternates: { canonical: '/novyny' },
}

export default function NewsPage() {
  return <NewsArchive view={getArchiveView(null, 1)} />
}
