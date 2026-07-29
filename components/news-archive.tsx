import Link from 'next/link'
import { NewsCard } from '@/components/news-card'
import { archiveHref, archiveYears, type ArchiveView } from '@/lib/news-archive'

export function NewsArchive({ view }: { view: ArchiveView }) {
  const years = archiveYears()
  const { items, total, page, totalPages, year } = view

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">Новини</h1>
      <p className="text-muted-foreground mb-6">
        {year ? `Публікації за ${year} рік — ${total}` : `Усього публікацій — ${total}`}
      </p>

      {/* Фільтр за роками */}
      <nav aria-label="Фільтр за роками" className="flex flex-wrap gap-2 mb-8">
        <Link
          href={archiveHref(null, 1)}
          aria-current={!year ? 'page' : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium border ${!year ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary'}`}
        >
          Усі роки
        </Link>
        {years.map((y) => (
          <Link
            key={y}
            href={archiveHref(y, 1)}
            aria-current={year === y ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border ${year === y ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary'}`}
          >
            {y}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">Публікацій не знайдено.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.slug} item={item} />
          ))}
        </div>
      )}

      {/* Пагінація */}
      {totalPages > 1 && (
        <nav aria-label="Пагінація" className="flex justify-center items-center gap-2 mt-10">
          {page > 1 && (
            <Link
              href={archiveHref(year, page - 1)}
              rel="prev"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:border-primary"
            >
              Попередня
            </Link>
          )}
          <span className="text-sm text-muted-foreground px-2">{`Сторінка ${page} з ${totalPages}`}</span>
          {page < totalPages && (
            <Link
              href={archiveHref(year, page + 1)}
              rel="next"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:border-primary"
            >
              Наступна
            </Link>
          )}
        </nav>
      )}
    </main>
  )
}
