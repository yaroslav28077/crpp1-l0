import Link from 'next/link'
import { FileText, Megaphone } from 'lucide-react'
import { getAllNews, type PageBlock } from '@/lib/content'
import { markdownToHtml } from '@/lib/markdown'
import { slugify } from '@/lib/slug'
import { PhotoGallery } from '@/components/photo-gallery'
import { formatDateUk } from '@/components/news-card'

/**
 * Блоки з Markdown усередині (текст, оголошення, розділ) рендеряться
 * асинхронно, тому HTML готується наперед, а не в самому компоненті.
 */
async function renderMarkdown(blocks: PageBlock[]): Promise<Map<number, string>> {
  const html = new Map<number, string>()
  await Promise.all(
    blocks.map(async (block, i) => {
      // Поля можуть бути відсутні: редактор має право зберегти блок, у якому
      // ще нічого не заповнив. Без ?? "" збірка ВСЬОГО сайту падала з
      // «Cannot read properties of undefined», не називаючи ні файлу, ні поля.
      if (block.type === 'text' || block.type === 'accordion' || block.type === 'notice') {
        html.set(i, await markdownToHtml(block.text ?? ''))
      } else if (block.type === 'news_by_topic' && block.extra) {
        html.set(i, await markdownToHtml(block.extra))
      }
    }),
  )
  return html
}

function NewsLinks({ items }: { items: { slug: string; title: string; date: string }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => (
        <li key={n.slug} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <time dateTime={n.date} className="text-xs text-muted-foreground shrink-0 sm:w-32">
            {formatDateUk(n.date)}
          </time>
          <Link href={`/novyny/${n.slug}`} className="text-primary hover:underline underline-offset-2">
            {n.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export async function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  if (blocks.length === 0) return null
  const html = await renderMarkdown(blocks)
  const news = getAllNews()

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'notice':
            return (
              <aside
                key={i}
                className="rounded-xl border border-accent bg-accent/10 p-5"
                aria-label={block.heading}
              >
                <p className="font-heading font-bold flex items-center gap-2 mb-2">
                  <Megaphone className="size-4 shrink-0" aria-hidden="true" />
                  {block.heading}
                </p>
                <div className="article-content" dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }} />
              </aside>
            )

          case 'text':
            return <div key={i} className="article-content" dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }} />

          case 'accordion':
            // Обгортка потрібна: стилі акордеонів у globals.css написані як
            // «.article-content details», тобто details має бути всередині
            return (
              <div key={i} className="article-content">
                <details>
                  <summary>{block.title}</summary>
                  <div dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }} />
                </details>
              </div>
            )

          case 'news_list': {
            // Редактор обирає новини зі списку, а підпис і дата беруться
            // з самої публікації — тож вони не розходяться з нею з часом
            // CMS зберігає назву файлу, а адреси в нас транслітеровані,
            // тож зіставляємо за тим самим правилом (див. lib/slug.ts)
            const items = (block.items ?? [])
              .map((ref) => {
                const key = slugify(String(ref).replace(/\.md$/, ''))
                return news.find((n) => n.slug === key)
              })
              .filter((n): n is NonNullable<typeof n> => Boolean(n))
            if (items.length === 0) return null
            return (
              <section key={i}>
                {block.title && <h2 className="font-heading text-xl font-bold mb-3">{block.title}</h2>}
                <NewsLinks items={items} />
              </section>
            )
          }

          case 'news_by_topic': {
            // Список збирається сам: усі публікації з цією темою, найновіші вгорі.
            // Лишається згорнутим, як був акордеон, який він замінив.
            const items = block.topic ? news.filter((n) => n.topics.includes(block.topic)) : []
            if (items.length === 0 && !block.extra) return null
            return (
              <div key={i} className="article-content">
                <details>
                  <summary>{block.title || 'Події'}</summary>
                  <div>
                    <NewsLinks items={items} />
                    {block.extra && (
                      <div className="mt-4 pt-3 border-t border-border" dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }} />
                    )}
                  </div>
                </details>
              </div>
            )
          }

          case 'documents': {
            // Рядок без адреси й без файлу показуємо звичайним текстом, а не
            // викидаємо: інакше праця редактора зникала б зі сторінки мовчки,
            // а якщо таких рядків усі — зникав би весь розділ із заголовком.
            const docs = (block.items ?? []).filter((d) => d?.label || d?.url || d?.file)
            if (docs.length === 0) return null
            const list = (
              <ul className="flex flex-col gap-2">
                {docs.map((doc, k) => {
                  // Завантажений файл має перевагу над вписаною адресою
                  const href = doc.file || doc.url || ''
                  return (
                    <li key={`${href}-${k}`}>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2 text-sm"
                        >
                          {doc.label || href}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">{doc.label}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )
            // Згорнутий вигляд повторює колишні розділи «Документи»,
            // які цей блок замінив
            if (block.collapsed) {
              return (
                <div key={i} className="article-content">
                  <details>
                    <summary>{block.title || 'Документи'}</summary>
                    <div>{list}</div>
                  </details>
                </div>
              )
            }
            return (
              <section key={i} className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-heading font-bold mb-3 flex items-center gap-2">
                  <FileText className="size-4" aria-hidden="true" />
                  {block.title || 'Документи'}
                </h2>
                {list}
              </section>
            )
          }

          case 'gallery':
            return <PhotoGallery key={i} items={block.images ?? []} title={block.title} />

          default:
            return null
        }
      })}
    </div>
  )
}
