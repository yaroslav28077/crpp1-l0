import Link from 'next/link'
import { ArrowRight, BadgeCheck, ExternalLink, FileText, Megaphone, Download } from 'lucide-react'
import {
  getAllCertificates,
  getAllNews,
  getPlanYears,
  type DocumentItem,
  type DocumentsView,
  type NewsItem,
  type PageBlock,
  type PlanMonth,
  type TableEntry,
  type TableField,
} from '@/lib/content'
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
      } else if (block.type === 'certificates' && block.intro) {
        html.set(i, await markdownToHtml(block.intro))
      } else if (block.type === 'plans' && block.intro) {
        html.set(i, await markdownToHtml(block.intro))
      }
    }),
  )
  return html
}

/**
 * Українська форма числа: 1 запис, 2 записи, 5 записів.
 * Мова має три форми, тож звичайне «(s)» тут не годиться.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = n % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
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

/**
 * Куда веде рядок. Порядок джерел важливий: завантажений файл — найнадійніший,
 * обрана публікація не залежить від того, чи не переїхала адреса, і лише
 * потім іде вписана вручну адреса.
 */
/*
  Іконка мусить відповідати тому, що станеться при натисканні. Блок «документи»
  редактори використовують і для файлів, і для посилань на власні сторінки чи
  зовнішні сайти — зі зашитою стрілкою завантаження виходило, що посилання на
  сторінку напрямку обіцяє завантажити файл.
*/
function docIcon(doc: DocumentItem, news: NewsItem[]) {
  const href = docHref(doc, news)
  if (!href) return FileText
  if (doc.file || /\.(pdf|docx?|xlsx?|pptx?|zip|rtf|odt|ods)$/i.test(href)) return Download
  return href.startsWith('/') ? ArrowRight : ExternalLink
}

function docHref(doc: DocumentItem, news: NewsItem[]): string {
  if (doc.file) return doc.file
  if (doc.news) {
    // CMS зберігає назву файлу, а адреси в нас транслітеровані (див. lib/slug.ts)
    const key = slugify(String(doc.news).replace(/\.md$/, ''))
    const found = news.find((n) => n.slug === key)
    if (found) return `/novyny/${found.slug}`
  }
  return doc.url ?? ''
}

/** Підпис рядка. Якщо обрано публікацію, а підпис не заповнили — беремо її назву */
function docLabel(doc: DocumentItem, news: NewsItem[]): string {
  if (doc.label) return doc.label
  if (doc.news) {
    const key = slugify(String(doc.news).replace(/\.md$/, ''))
    const found = news.find((n) => n.slug === key)
    if (found) return found.title
  }
  return doc.url || ''
}

/** Рядок без адреси лишається текстом: це заголовок групи або слід зі старого сайту */
function hasContent(doc: DocumentItem): boolean {
  return Boolean(doc?.label || doc?.url || doc?.file || doc?.news || doc?.children?.length)
}

function DocLink({ doc, news, className = '' }: { doc: DocumentItem; news: NewsItem[]; className?: string }) {
  const href = docHref(doc, news)
  const label = docLabel(doc, news)
  if (!href) return <span className={`text-foreground ${className}`}>{label}</span>

  // Внутрішні сторінки — через Link, щоб не перезавантажувати весь сайт,
  // і без target="_blank": усередині сайту нове вікно тільки заважає
  const internal = href.startsWith('/')
  const cls = `text-primary hover:underline underline-offset-2 ${className}`
  if (internal) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {label}
    </a>
  )
}

/**
 * Перелік документів. Вкладені накази й додатки показуються підпорядкованим
 * списком — раніше цю вкладеність доводилося робити відступами в Markdown.
 */
function DocumentList({
  items,
  news,
  numbered,
}: {
  items: DocumentItem[]
  news: NewsItem[]
  numbered?: boolean
}) {
  const List = numbered ? 'ol' : 'ul'
  return (
    <List className={`flex flex-col gap-2 ${numbered ? 'list-decimal pl-5' : ''}`}>
      {items.map((doc, k) => (
        <li key={k} className="flex flex-col gap-1.5 text-sm leading-relaxed">
          <DocLink doc={doc} news={news} />
          {doc.children && doc.children.filter(hasContent).length > 0 && (
            <ul className="flex flex-col gap-1.5 pl-4 border-l border-border ml-1">
              {doc.children.filter(hasContent).map((child, c) => {
                const ChildIcon = docIcon(child, news)
                return (
                  <li key={c} className="flex items-baseline gap-2">
                    <ChildIcon
                      className="size-3.5 shrink-0 text-muted-foreground translate-y-0.5"
                      aria-hidden="true"
                    />
                    <DocLink doc={child} news={news} />
                  </li>
                )
              })}
            </ul>
          )}
        </li>
      ))}
    </List>
  )
}

/** Плитки: по документу на плитку. Для кількох бланків, які треба помітити */
function DocumentGrid({ items, news }: { items: DocumentItem[]; news: NewsItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((doc, k) => {
        const children = doc.children?.filter(hasContent) ?? []
        const Icon = docIcon(doc, news)
        return (
          <li key={k} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
            <p className="flex items-baseline gap-2 text-sm font-medium">
              <Icon className="size-4 shrink-0 text-muted-foreground translate-y-0.5" aria-hidden="true" />
              <DocLink doc={doc} news={news} />
            </p>
            {children.length > 0 && (
              <ul className="flex flex-col gap-1 pl-6 text-sm">
                {children.map((child, c) => (
                  <li key={c}>
                    <DocLink doc={child} news={news} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Успадкована сумісність: до появи кількох виглядів вибір задавався одним
 * прапорцем. Сторінки, збережені тоді, не мають поля `view` — і без цього
 * зіставлення всі вони раптово змінили б вигляд.
 */
function resolveView(view: DocumentsView | undefined, collapsed: boolean | undefined): DocumentsView {
  if (view) return view
  return collapsed ? 'collapsed' : 'card'
}

/**
 * Спільна оболонка розділу. Один і той самий вміст (перелік чи таблиця)
 * подається чотирма способами, тож обгортк�� вибирається тут, а не
 * дублюється в кожному блоці.
 */
function Section({
  view,
  title,
  fallbackTitle,
  children,
}: {
  view: DocumentsView
  title?: string
  fallbackTitle: string
  children: React.ReactNode
}) {
  /*
    Згорнутому розділу й картці заголовок потрібен конче: без нього не буде
    чого клацати. А розкритий список цілком може йти без назви — тоді
    підставляти «Документи» не треба, це вигаданий заголовок.
  */
  const optional = view === 'open' || view === 'grid'
  const heading = title || (optional ? '' : fallbackTitle)

  if (view === 'collapsed') {
    // Стилі акордеонів у globals.css написані як «.article-content details»,
    // тобто details має бути всередині цієї обгортки
    return (
      <div className="article-content">
        <details>
          <summary>{heading}</summary>
          <div>{children}</div>
        </details>
      </div>
    )
  }

  if (view === 'card') {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading font-bold mb-3 flex items-center gap-2">
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          {heading}
        </h2>
        {children}
      </section>
    )
  }

  // open і grid: заголовок без рамки, вміст одразу видно
  return (
    <section>
      {heading && <h2 className="font-heading text-xl font-bold mb-3">{heading}</h2>}
      {children}
    </section>
  )
}

/**
 * Клітинка таблиці. Секретар вставляє телефон або пошту звичайним текстом,
 * а посилання робляться самі — інакше довелося б знати Markdown-синтаксис.
 */
function TableCell({ value }: { value: string }) {
  const text = (value ?? '').trim()
  if (!text) return null

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    return (
      <a href={`mailto:${text}`} className="text-primary hover:underline underline-offset-2 break-all">
        {text}
      </a>
    )
  }
  if (/^https?:\/\//.test(text)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline underline-offset-2 break-all"
      >
        {text}
      </a>
    )
  }
  // Телефон: цифри, пробіли, дужки й дефіси, щонайменше 6 цифр
  if (/^[\d\s()+-]{6,}$/.test(text) && (text.match(/\d/g)?.length ?? 0) >= 6) {
    return (
      <a href={`tel:${text.replace(/[^\d+]/g, '')}`} className="text-primary hover:underline underline-offset-2">
        {text}
      </a>
    )
  }
  return <>{text}</>
}

/**
 * Стовпці планів роботи. Раніше вони лежали в кожному з 62 блоків окремо, і
 * редакторові доводилось тримати два списки (підписи й склад полів) у голові.
 * Тепер це одне місце в коді: підписи однакові для всіх місяців.
 */
const PLAN_COLUMNS = ['№ з/п', 'Назва заходів', 'Дата проведення', 'Відповідальний']
const PLAN_FIELDS: TableField[] = ['event', 'date', 'responsible']

/** «1 захід», «2 заходи», «5 заходів» — щоб покажчик років не писав «281 заходів». */
function pluralUk(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = n % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/**
 * Місяці плану одного року. Виділено окремо, бо тепер їх показує сторінка
 * `/plany-roboty/<рік>`, а не спільна сторінка планів: 62 місяці в одному
 * документі давали 1,88 МБ HTML і майже 1 900 рядків таблиць.
 */
export function PlanMonthTables({ months }: { months: PlanMonth[] }) {
  return (
    <div className="flex flex-col gap-6">
      {months.map((month) => (
        <TableSection
          key={month.slug}
          title={month.title}
          columns={PLAN_COLUMNS}
          fields={PLAN_FIELDS}
          entries={month.entries}
          view="collapsed"
        />
      ))}
    </div>
  )
}

/**
 * Таблиця розділу. Спільна для блока «Таблиця» і для планів роботи: інакше
 * дві розмітки з часом розійшлися б, і плани почали б виглядати інакше за
 * решту таблиць сайту.
 */
function TableSection({
  title,
  columns,
  fields,
  entries,
  rows,
  view,
}: {
  title?: string
  columns: string[]
  fields: TableField[]
  entries?: TableEntry[]
  rows?: { cells: string[] }[]
  view: DocumentsView
}) {
  /*
    Новий формат: рядок — це іменовані поля, а `fields` каже, яке поле
    стоїть у якому стовпці. Порядок стовпців і шапка лишаються ті самі,
    що були в безіменних клітинках, тож сторінка виглядає так само.
    № з/п не зберігаємо в даних — беремо з індексу, як у сертифікатах.
  */
  const numbered = /^\s*№/.test(columns[0] ?? '')
  let counter = 0
  const fromEntries = (entries ?? []).map((e) => {
    // Підпис під таблицею («Директор ЦПРПП …») нумерації не отримує
    if (e?.note) return [e.note, ...Array(numbered ? fields.length : fields.length - 1).fill('')]
    counter += 1
    const values = fields.map((f) => String(e?.[f] ?? ''))
    return numbered ? [String(counter), ...values] : values
  })
  const fromRows = (rows ?? []).map((r) => (r?.cells ?? []).map((c) => String(c ?? '')))
  const tableRows = (fromEntries.length > 0 ? fromEntries : fromRows).filter((cells) =>
    cells.some((c) => c.trim()),
  )
  if (tableRows.length === 0) return null

  return (
    <Section view={view} title={title} fallbackTitle="Таблиця">
      {/* Таблиці контактів широкі, тож на телефоні гортаються збоку */}
      <div className="overflow-x-auto">
        {/*
          min-w тут обов'язковий: з одним лише w-full таблиця
          стискається до ширини екрана, назви закладів ламаються на
          два-три символи, а overflow-x-auto не спрацьовує ніколи.
        */}
        <table className="w-full min-w-[36rem] text-sm border-collapse">
          {columns.length > 0 && (
            <thead>
              <tr className="border-b border-border">
                {columns.map((col, c) => (
                  <th key={c} scope="col" className="text-left font-heading font-bold p-2 align-bottom">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {tableRows.map((cells, r) => (
              <tr key={r} className="border-b border-border last:border-0 align-top">
                {cells.map((cell, c) => (
                  <td key={c} className="p-2 leading-relaxed">
                    <TableCell value={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

export async function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  if (blocks.length === 0) return null
  const html = await renderMarkdown(blocks)
  const news = getAllNews()
  // Читаємо лише коли на сторінці справді є такий блок: переліки важкі
  const certificates = blocks.some((b) => b.type === 'certificates') ? getAllCertificates() : []
  // Так само з планами: тепер потрібні лише роки, а не 1 836 рядків усіх місяців
  const planYears = blocks.some((b) => b.type === 'plans') ? getPlanYears() : []

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
            // Типово згорнутий, як був акордеон, який він замінив, — крім
            // сторінок, де редактор попросив показати одразу (`open`).
            const items = block.topic ? news.filter((n) => n.topics.includes(block.topic)) : []
            if (items.length === 0 && !block.extra) return null
            const body = (
              <>
                <NewsLinks items={items} />
                {/*
                  Ці назви лишилися без посилань: сторінки з ними не
                  перенеслися зі старого сайту. Без підпису вони стоять поряд
                  зі справжніми посиланнями однаковим списком, і виглядає
                  так, ніби частина посилань просто не працює. Тому кажемо
                  прямо, що це перелік без матеріалів.
                */}
                {block.extra && (
                  <div className="mt-4 pt-3 border-t border-border text-muted-foreground">
                    <p className="text-xs uppercase tracking-wide mb-2">Заходи, матеріали яких не опубліковані</p>
                    <div className="text-sm" dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }} />
                  </div>
                )}
              </>
            )
            return (
              <Section key={i} view={block.open ? 'open' : 'collapsed'} title={block.title} fallbackTitle="Події">
                {body}
              </Section>
            )
          }

          case 'documents': {
            // Рядок без адреси показуємо звичайним текстом, а не викидаємо:
            // інакше праця редактора зникала б зі сторінки мовчки, а якби
            // таких рядків були всі — зник би весь розділ із заголовком.
            const docs = (block.items ?? []).filter(hasContent)
            if (docs.length === 0) return null
            const view = resolveView(block.view, block.collapsed)
            return (
              <Section key={i} view={view} title={block.title} fallbackTitle="Документи">
                {view === 'grid' ? (
                  <DocumentGrid items={docs} news={news} />
                ) : (
                  <DocumentList items={docs} news={news} numbered={block.numbered} />
                )}
              </Section>
            )
          }

          case 'table':
            /*
              Розмітка спільна з планами роботи — див. TableSection. Таблиці
              великі, тож без окремого вибору лишаються згорнутими: такими вони
              й були, коли жили в акордеонах.
            */
            return (
              <TableSection
                key={i}
                title={block.title}
                columns={(block.columns ?? []).map((c) => String(c ?? ''))}
                fields={(block.fields ?? []) as TableField[]}
                entries={block.entries}
                rows={block.rows}
                view={resolveView(block.view, true)}
              />
            )

          case 'plans': {
            if (planYears.length === 0) return null
            /*
              Раніше тут виводились усі 62 місяці одразу: 1,88 МБ HTML і 1 898
              рядків таблиць в одному документі. Тепер це покажчик років, а самі
              таблиці живуть на /plany-roboty/<рік>. Адреса сторінки не змінилась,
              тож legacy-редиректи зі старого сайту працюють як раніше.
            */
            return (
              <div key={i} className="flex flex-col gap-6">
                {block.intro && (
                  <div
                    className="article-content"
                    dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }}
                  />
                )}
                <nav aria-label="Плани роботи за роками">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {planYears.map((y) => (
                      <li key={y.year}>
                        <Link
                          href={`/plany-roboty/${y.year}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary hover:bg-accent transition-colors"
                        >
                          <span className="flex flex-col">
                            <span className="font-heading font-bold">{y.year} рік</span>
                            <span className="text-sm text-muted-foreground">
                              {y.months} {pluralUk(y.months, 'місяць', 'місяці', 'місяців')} ·{' '}
                              {y.entries} {pluralUk(y.entries, 'захід', 'заходи', 'заходів')}
                            </span>
                          </span>
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            )
          }

          case 'certificates': {
            if (certificates.length === 0 && !block.extra) return null
            /*
              Переліків п'ять десятків, тож групуємо за роком заходу: інакше
              це суцільна стіна схожих назв, у якій нічого не знайти. Найновіші
              роки вгорі — саме їх шукають найчастіше.
            */
            const byYear = new Map<string, typeof certificates>()
            for (const c of certificates) {
              const year = c.date ? c.date.slice(0, 4) : 'Без дати'
              const list = byYear.get(year)
              if (list) list.push(c)
              else byYear.set(year, [c])
            }
            const years = [...byYear.keys()].sort((a, b) => {
              if (a === 'Без дати') return 1
              if (b === 'Без дати') return -1
              return a < b ? 1 : -1
            })
            // Поле заповнюється як звичайний список: по назві заходу на рядок
            const extraItems = (block.extra ?? '')
              .split('\n')
              .map((s) => s.replace(/^\s*[-*•]\s*/, '').trim())
              .filter(Boolean)
            return (
              <section key={i} aria-label={block.title || 'Облік сертифікатів'}>
                {block.title && <h2 className="font-heading text-xl font-bold mb-3">{block.title}</h2>}
                {block.intro && (
                  <div
                    className="article-content mb-4"
                    dangerouslySetInnerHTML={{ __html: html.get(i) ?? '' }}
                  />
                )}
                <div className="flex flex-col gap-4">
                  {years.map((year) => (
                    <div key={year}>
                      <h3 className="font-heading font-bold text-sm text-muted-foreground mb-2">{year}</h3>
                      <ul className="flex flex-col gap-2">
                        {byYear.get(year)!.map((c) => (
                          <li key={c.slug}>
                            <Link
                              href={`/oblik-sertyfikativ/${c.slug}`}
                              className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 hover:border-primary transition-colors"
                            >
                              <BadgeCheck className="size-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
                              <span>
                                <span className="block font-medium text-pretty leading-relaxed">{c.title}</span>
                                <span className="block text-xs text-muted-foreground mt-0.5">
                                  {c.event ? `${c.event} · ` : ''}
                                  {c.entries.length} {plural(c.entries.length, 'запис', 'записи', 'записів')}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {/*
                  Заходи без опублікованого переліку. Показуємо їх звичайним
                  текстом, а не посиланнями: клац у нікуди гірший за його
                  відсутність. Розділ згорнутий, щоб не забивати сторінку.
                */}
                {extraItems.length > 0 && (
                  <div className="article-content mt-4">
                    <details>
                      <summary>Заходи, переліки яких ще не опубліковані ({extraItems.length})</summary>
                      <ul>
                        {extraItems.map((label, k) => (
                          <li key={k}>{label}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </section>
            )
          }

          case 'gallery':
            return <PhotoGallery key={i} items={block.images ?? []} title={block.title} />

          case 'partners': {
            const partners = (block.items ?? []).filter((p) => p?.image || p?.name)
            if (partners.length === 0) return null
            return (
              <section key={i} aria-label={block.title || 'Партнери'}>
                {block.title && <h2 className="font-heading font-bold text-xl mb-4">{block.title}</h2>}
                {/* Ті самі класи, що були в сирому HTML — вигляд плитки не змінюється */}
                <div className="article-content">
                  <div className="partners-grid">
                    {partners.map((p, k) => {
                      const logo = p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- логотипи різних пропорцій, next/image тут обрізав би їх
                        <img src={p.image} alt={p.name || ''} loading="lazy" />
                      ) : (
                        <span className="text-sm text-center">{p.name}</span>
                      )
                      return p.url ? (
                        <a key={k} href={p.url} target="_blank" rel="noopener noreferrer" title={p.name}>
                          {logo}
                        </a>
                      ) : (
                        <div key={k}>{logo}</div>
                      )
                    })}
                  </div>
                </div>
              </section>
            )
          }

          default:
            return null
        }
      })}
    </div>
  )
}
