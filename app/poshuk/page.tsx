import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchResults } from '@/components/search-results'

export const metadata: Metadata = {
  title: 'Пошук',
  description: 'Пошук серед новин і сторінок сайту ЦПРПП м. Лубни',
  alternates: { canonical: '/poshuk' },
  // Сторінка результатів пошуку не має потрапляти у видачу
  robots: { index: false, follow: true },
}

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-6">Пошук</h1>
      {/* Запит читається з адреси на боці клієнта, тож сторінка лишається статичною */}
      <Suspense fallback={<p className="text-muted-foreground py-8 text-center">Завантаження…</p>}>
        <SearchResults />
      </Suspense>
    </main>
  )
}
