import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import type { NewsItem } from '@/lib/content'

export function formatDateUk(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="group flex flex-col rounded-xl bg-card border border-border overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/novyny/${item.slug}`} className="flex flex-col flex-1">
        {item.cover ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
            {/* Розмите тло з того ж фото — заповнює простір навколо вертикальних знімків */}
            <img
              src={item.cover || '/placeholder.svg'}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 size-full object-cover scale-110 blur-lg opacity-60"
            />
            <img
              src={item.cover || '/placeholder.svg'}
              alt=""
              loading="lazy"
              className="relative size-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="aspect-[16/10] bg-secondary flex items-center justify-center">
            <CalendarDays className="size-10 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-col gap-2 p-4 flex-1">
          <time dateTime={item.date} className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDateUk(item.date)}
          </time>
          <h3 className="font-heading font-bold leading-snug text-pretty group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{item.description}</p>
          )}
        </div>
      </Link>
    </article>
  )
}
