import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { getAllPages, getPageBySlug } from '@/lib/content'
import { markdownToHtml } from '@/lib/markdown'
import { PhotoGallery } from '@/components/photo-gallery'
import { PageBlocks } from '@/components/page-blocks'

export function generateStaticParams() {
  return getAllPages().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = getPageBySlug(slug)
  if (!page) return {}
  return {
    // У <title> лишається короткий ярлик: повна назва не влазить у вкладку і видачу
    title: page.seo_title || page.title,
    description: page.seo_description || page.full_title || undefined,
  }
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = getPageBySlug(slug)
  if (!page) notFound()

  // Сторінки переведено на блоки, але body лишається для сумісності. Показуємо
  // його щоразу, коли він непорожній, а не лише за відсутності блоків: інакше
  // редактор, який почав переносити стару сторінку і додав перший блок,
  // одразу втрачав із сайту весь її текст, нічого про це не знаючи.
  const legacyHtml = page.body.trim() ? await markdownToHtml(page.body) : null

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        {page.section && (
          <p className="text-sm font-medium text-accent-foreground bg-accent inline-block rounded-full px-3 py-1 mb-3">
            {page.section}
          </p>
        )}
        {/* Меню показує короткий ярлик, а на самій сторінці доречна повна офіційна назва */}
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-balance">
          {page.full_title || page.title}
        </h1>
      </header>

      <PageBlocks blocks={page.blocks} />

      {legacyHtml !== null && (
        <div
          className={`article-content${page.blocks.length > 0 ? ' mt-6' : ''}`}
          dangerouslySetInnerHTML={{ __html: legacyHtml }}
        />
      )}

      {page.attachments.length > 0 && (
        <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-label="Прикріплені файли">
          <h2 className="font-heading font-bold mb-3 flex items-center gap-2">
            <Paperclip className="size-4" aria-hidden="true" />
            Файли
          </h2>
          <ul className="flex flex-col gap-2">
            {page.attachments.map((a) => (
              <li key={a.file}>
                <a href={a.file} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 text-sm">
                  {a.label || a.file.split('/').at(-1)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {page.gallery.length > 0 && (
        <div className="mt-10">
          <PhotoGallery items={page.gallery} title="Фотогалерея" />
        </div>
      )}
    </main>
  )
}
