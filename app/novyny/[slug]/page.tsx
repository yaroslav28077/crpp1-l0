import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Paperclip } from 'lucide-react'
import { getAllNews, getNewsBySlug } from '@/lib/content'
import { markdownToHtml } from '@/lib/markdown'
import { PhotoGallery } from '@/components/photo-gallery'
import { formatDateUk } from '@/components/news-card'

export function generateStaticParams() {
  return getAllNews().map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = getNewsBySlug(slug)
  if (!item) return {}
  return {
    title: item.seo_title || item.title,
    description: item.seo_description || item.description,
    openGraph: item.cover ? { images: [{ url: item.cover }] } : undefined,
  }
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = getNewsBySlug(slug)
  if (!item) notFound()

  const html = await markdownToHtml(item.body)

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/novyny" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-6">
        <ArrowLeft className="size-4" aria-hidden="true" />
        До всіх новин
      </Link>

      <article>
        <header className="mb-8">
          <time dateTime={item.date} className="text-sm text-muted-foreground flex items-center gap-1.5 mb-3">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateUk(item.date)}
          </time>
          <h1 className="font-heading text-2xl md:text-4xl font-bold leading-tight text-balance">{item.title}</h1>
        </header>

        <div className="article-content" dangerouslySetInnerHTML={{ __html: html }} />

        {/* Підпис автора. Раніше його верстали таблицею просто в тексті,
            тож вигляд гуляв від новини до новини */}
        {item.author && (
          <p className="mt-6 pt-4 border-t border-border text-sm text-muted-foreground text-right whitespace-pre-line">
            {item.author}
          </p>
        )}

        {item.attachments.length > 0 && (
          <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-label="Прикріплені файли">
            <h2 className="font-heading font-bold mb-3 flex items-center gap-2">
              <Paperclip className="size-4" aria-hidden="true" />
              Файли
            </h2>
            <ul className="flex flex-col gap-2">
              {item.attachments.map((a) => (
                <li key={a.file}>
                  <a href={a.file} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 text-sm">
                    {a.label || a.file.split('/').at(-1)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {item.gallery.length > 0 && (
          <div className="mt-10">
            <PhotoGallery items={item.gallery} title="Фотогалерея" />
          </div>
        )}
      </article>
    </main>
  )
}
