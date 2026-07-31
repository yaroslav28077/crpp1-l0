import fs from "fs"
import path from "path"
import matter from "gray-matter"
import * as yaml from "js-yaml"
import { slugify } from "./slug"

const CONTENT_DIR = path.join(process.cwd(), "content")

export interface GalleryItem {
  image: string
  caption?: string
}

export interface AttachmentItem {
  label: string
  file: string
}

export interface NewsItem {
  slug: string
  title: string
  date: string
  description?: string
  cover?: string
  /**
   * Хто підготував публікацію. На старому сайті це була таблиця з однієї
   * клітинки в кінці тексту — тепер окреме поле, однакове в усіх новинах.
   */
  author?: string
  tags: string[]
  /**
   * Теми, до яких належить публікація. Збігаються з адресами сторінок
   * спільнот (doshkillia, shkilna-biblioteka…): за ними сторінки самі
   * збирають свої списки «Події».
   */
  topics: string[]
  gallery: GalleryItem[]
  attachments: AttachmentItem[]
  body: string
  seo_title?: string
  seo_description?: string
}

/**
 * Блоки сторінки. Замінили суцільний Markdown із сирими <details>: тепер
 * кожен розділ — окреме поле в адмінці, яке можна перейменувати, переставити
 * чи видалити, не знаючи верстки.
 *
 * Усередині «Тексту» та «Розділу» лишається Markdown: там трапляються
 * таблиці й вкладені списки, для яких окремих полів не напасешся.
 * Для щоденних завдань є структуровані блоки — новини й документи.
 */
export type PageBlock =
  /** Виділена рамка-оголошення вгорі сторінки */
  | { type: "notice"; heading: string; text: string }
  /** Довільний текст */
  | { type: "text"; text: string }
  /** Розгортуваний розділ («Події», «Документи» тощо) */
  | { type: "accordion"; title: string; text: string }
  /** Список новин: редактор обирає публікації зі списку, а не вписує адреси */
  | { type: "news_list"; title?: string; items: string[] }
  /**
   * Список новин, що збирається сам за темою. Досі такі списки вели вручну
   * і систематично забували поповнювати. `extra` — сліди матеріалів, які не
   * перенеслися зі старого сайту: вони лишилися без посилань, тож
   * зберігаються під списком як текст.
   */
  | {
      type: "news_by_topic"
      title?: string
      topic: string
      extra?: string
      /**
       * Показувати список одразу, не згорнутим. Потрібно там, де цей блок —
       * основний вміст сторінки (напрямки ЗСО): згорнутим він лишає сторінку
       * візуально порожньою. На довгих сторінках, де таких розділів кілька,
       * згорнутий зручніший, тож він і лишається типовим.
       */
      open?: boolean
    }
  /**
   * Список документів. Редактор заповнює «Назву» і «Посилання» в окремих
   * полях, а не робить посилання руками в Markdown.
   */
  | {
      type: "documents"
      title?: string
      /**
       * Успадковане поле. Раніше вигляд задавався одним прапорцем
       * «згорнути», тепер їх кілька — див. `view`. Лишається, щоб сторінки,
       * збережені до цієї зміни, не змінили вигляду.
       */
      collapsed?: boolean
      view?: DocumentsView
      /** Нумерувати рядки: для переліків нормативних документів */
      numbered?: boolean
      items: DocumentItem[]
    }
  /**
   * Таблиця: керівники закладів, контакти, розподіл напрямів роботи.
   * Раніше такі таблиці жили в Markdown синтаксисом `| --- |`, де
   * досить прибрати одну риску, щоб розсипалася вся таблиця.
   */
  | {
      type: "table"
      title?: string
      view?: DocumentsView
      /** Назви стовпців. Порожній перший стовпець = нумерація рядків */
      columns: string[]
      rows: { cells: string[] }[]
    }
  /** Фотогалерея */
  | { type: "gallery"; title?: string; images: GalleryItem[] }
  /**
   * Логотипи партнерів плиткою. Досі це був єдиний на сайті блок сирого
   * HTML: п'ятнадцять <a><img></a> усередині <div class="partners-grid">.
   * Щоб додати партнера, секретарю довелося б копіювати теги й не
   * помилитися в лапках — тепер це назва, логотип і посилання полями.
   */
  | { type: "partners"; title?: string; items: PartnerItem[] }
  /**
   * Переліки виданих документів. Список збирається сам із колекції
   * «Облік сертифікатів», тож редактор ніде не вписує посилань: додав захід —
   * він з'явився на сторінці. Раніше такі списки вели вручну, і саме тому
   * шістдесят чотири підписи лишилися без адрес.
   */
  | {
      type: "certificates"
      title?: string
      intro?: string
      /**
       * Заходи, переліки яких на сайті ще не опубліковані, — по назві на
       * рядок. В архіві старого сайту таблиці є лише за 2021–2024 роки, а
       * підписи були й за пізніші: викидати їх не можна, це слід проведеної
       * роботи. Щойно секретар створить перелік у розділі «Облік
       * сертифікатів», відповідний рядок звідси прибирається.
       */
      extra?: string
    }

/**
 * Як показувати розділ. Раніше вибір був двійковий (згорнутий чи ні), але
 * розділи на сайті різні за призначенням: архів документів має бути
 * закритий, короткий перелік — одразу видимий, а важливі бланки помітні.
 */
export type DocumentsView =
  /** Закритий, доки відвідувач не клацне по заголовку */
  | "collapsed"
  /** Одразу розкритий список */
  | "open"
  /** Картка з рамкою й піктограмою — привертає увагу */
  | "card"
  /** Плитки: по файлу на плитку, зручно для кількох бланків */
  | "grid"

/** Рядок у списку документів. Може мати вкладені накази й додатки. */
export interface DocumentItem {
  label?: string
  /** Зовнішня адреса (Google Диск) або внутрішня на кшталт /novyny/… */
  url?: string
  /** Файл, завантажений на сам сайт. Має перевагу над `url` */
  file?: string
  /**
   * Публікація на сайті, обрана зі списку замість ручного вписування
   * адреси. Зберігається як slug — див. `resolveDocHref`.
   */
  news?: string
  /**
   * Вкладені файли: «Наказ про проведення», «Додаток 1»… Досі такі
   * підпоря����ковані посилання робилися відступом у Markdown-списку.
   */
  children?: DocumentItem[]
}

/** Партнер: логотип із посиланням на його сайт */
export interface PartnerItem {
  /** Назва установи. Йде в alt — без неї логотип не читає озвучувач екрана */
  name: string
  image?: string
  url?: string
}

export interface PageItem {
  slug: string
  /** Короткий ярлик — те, що показує меню */
  title: string
  /**
   * Повна офіційна назва, коли вона довша за ярлик меню (наприклад
   * «Стратегія розвитку» -> «Стратегія розвитку Комунальної установи …»).
   * Її пише міграція, коли заголовок тіддлера відрізнявся від пункту меню.
   */
  full_title?: string
  section?: string
  /**
   * Адреса сторінки, підрозділом якої ця є. Дає посилання «назад»: напрямки
   * ЗСО та подібні підсторінки відкривають і з пошуку, і за прямим
   * посиланням, а тоді відвідувач не має як повернутися до свого розділу —
   * у головному меню таких сторінок немає.
   */
  parent?: string
  /** Тіло старого формату. Лишається для сумісності; нові сторінки — у blocks */
  body: string
  blocks: PageBlock[]
  gallery: GalleryItem[]
  attachments: AttachmentItem[]
  seo_title?: string
  seo_description?: string
}

/**
 * Перелік виданих документів про підвищення кваліфікації.
 *
 * На старому сайті кожен такий перелік був окремою підсторінкою з таблицею,
 * і саме вони не перенеслися: на новому сайті лишилися тільки підписи без
 * посилань. Педагог не міг знайти свій обліковий номер — а це головне, по що
 * він на сторінку заходить. Тепер це власна колекція: один перелік — один
 * файл, тож секретар додає новий захід, не чіпаючи сторінку.
 */
export interface CertificateItem {
  slug: string
  title: string
  /** Дата заходу в ISO. За нею переліки сортуються, найновіші вгорі */
  date?: string
  /** Підпис із таблиці старого сайту: «22 березня 2024 року» */
  event?: string
  columns: string[]
  rows: { cells: string[] }[]
}

export interface TeamMember {
  name: string
  position: string
  photo?: string
  order: number
  bio?: string
}

export interface NavItem {
  label: string
  url: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export interface SiteSettings {
  site_name: string
  site_short_name: string
  site_description: string
  /** Знак у шапці — герб Лубен */
  logo?: string
  /**
   * Повна емблема Центру з назвою та гаслом. Її текст темно-синій, тож на
   * темних поверхнях сайту вона стоїть на світлій плашці
   * (див. components/brand.tsx).
   */
  logo_emblem?: string
  /** Гасло з логотипа, по слову на елемент: «Натхнення», «Мудрість», «Успіх» */
  tagline: string[]
  address?: string
  map_url?: string
  phones: string[]
  email?: string
  consultation_url?: string
  schedule: { days: string; hours: string }[]
  partners: { name: string; image?: string; url?: string }[]
}

function readMd(dir: string) {
  const full = path.join(CONTENT_DIR, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(full, f), "utf-8")
      const { data, content } = matter(raw)
      return { file: f, data, content }
    })
}

/**
 * Дата з frontmatter у вигляді ISO.
 *
 * Значення приходить із CMS, тож може виявитися нечитним (наприклад,
 * «26.07.2026T10:00»). Без запобіжника new Date(...).toISOString() кидає
 * RangeError і валить збірку ВСЬОГО сайту через одну публікацію: на Netlify
 * це провалений деплой, і сайт застигає на попередній версії.
 * Краще показати таку новину з датою файлу й лишити сайт робочим.
 */
function parseDate(value: unknown, file: string): string {
  if (value) {
    const d = new Date(value as string)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
    console.warn(`[content] Нечитна дата у content/news/${file}: ${JSON.stringify(value)}`)
  }
  const fromName = file.match(/^(\d{4}-\d{2}-\d{2})/)
  if (fromName) {
    const d = new Date(`${fromName[1]}T12:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return "1970-01-01T00:00:00.000Z"
}

/**
 * Короткий опис для картки новини й для сніпета в пошуковиках.
 *
 * Якщо редактор його не заповнив, беремо перший змістовний абзац: інакше
 * картка виглядала б голою, а Google показав би випадковий уривок сторінки.
 * Так поле стає справді необов'язковим.
 */
function deriveDescription(explicit: unknown, body: string, title: string): string | undefined {
  const given = explicit ? String(explicit).trim() : ""
  if (given) return given

  // Опис, що лише переказує заголовок, нічого не додає: у картці той самий
  // текст стояв би двічі, а пошуковики такий сніпет ігнорують
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
  const normTitle = norm(title)

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (/^(#|\||<|!\[|>|-{3,}|\*|\d+\.|-\s)/.test(line)) continue
    const clean = line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[*_`]{1,3}/g, "")
      .replace(/\s+/g, " ")
      .trim()
    if (clean.length <= 40) continue
    // Відкидаємо лише абзац, який САМ Є переказом заголовка. Перевіряти ще й
    // зворотний напрям не можна: типовий український лід («26 квітня 2023 року
    // відбувся семінар-практикум учителів математики…») містить назву заходу
    // як підрядок, і його теж викидало — опис брався із середини статті.
    const n = norm(clean)
    if (normTitle && normTitle.includes(n)) continue
    if (clean.length <= 160) return clean
    const cut = clean.slice(0, 159)
    const lastSpace = cut.lastIndexOf(" ")
    return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—–\-(«"]+$/, "") + "…"
  }
  return undefined
}

/**
 * Розводить однакові адреси.
 *
 * Адреса будується транслітерацією назви файлу, тож різні назви можуть дати
 * однакову: «Атестація» -> atestatsiia так само, як наявна atestatsiia.md.
 * Без цього друга сторінка мовчки зникала: Next пререндерив лише один
 * маршрут, getPageBySlug брав перший збіг, а редактор бачив «опубліковано»
 * і стару сторінку за своєю адресою. Ні помилки, ні попередження.
 */
function ensureUniqueSlugs<T extends { slug: string; title: string }>(items: T[], where: string): T[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const count = seen.get(item.slug) ?? 0
    seen.set(item.slug, count + 1)
    if (count === 0) return item
    const unique = `${item.slug}-${count + 1}`
    console.warn(
      `[content] Збіг адрес у ${where}: «${item.title}» дає ту саму адресу /${item.slug}, ` +
        `що й попередня сторінка. Ця отримала /${unique}. Перейменуйте одну зі сторінок.`,
    )
    return { ...item, slug: unique }
  })
}

// Кешуємо лише в продакшні: у дев-режимі редактор має бачити нові файли одразу
const isProd = process.env.NODE_ENV === "production"

let newsCache: NewsItem[] | null = null

export function getAllNews(): NewsItem[] {
  if (isProd && newsCache) return newsCache
  const items = readMd("news").map(({ file, data, content }) => {
    const gallery: GalleryItem[] = Array.isArray(data.gallery) ? data.gallery.filter((g: GalleryItem) => g?.image) : []
    return {
      // Через slugify, бо CMS називає нові файли кирилицею — див. lib/slug.ts
      slug: slugify(file.replace(/\.md$/, "")),
      title: String(data.title || file),
      date: parseDate(data.date, file),
      description: deriveDescription(data.description, content, String(data.title || "")),
      author: data.author ? String(data.author).trim() : undefined,
      cover: data.cover ? String(data.cover) : gallery[0]?.image,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      topics: Array.isArray(data.topics) ? data.topics.map(String) : [],
      gallery,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      body: content,
      seo_title: data.seo_title,
      seo_description: data.seo_description,
    }
  })
  items.sort((a, b) => (a.date < b.date ? 1 : -1))
  newsCache = ensureUniqueSlugs(items, "content/news")
  return newsCache
}

export function getNewsBySlug(slug: string): NewsItem | undefined {
  return getAllNews().find((n) => n.slug === slug)
}

export function getNewsYears(): string[] {
  const years = new Set(getAllNews().map((n) => n.date.slice(0, 4)))
  return Array.from(years).sort((a, b) => (a < b ? 1 : -1))
}

let pagesCache: PageItem[] | null = null

export function getAllPages(): PageItem[] {
  if (isProd && pagesCache) return pagesCache
  pagesCache = readMd("pages").map(({ file, data, content }) => ({
    slug: slugify(String(data.slug || file.replace(/\.md$/, ""))),
    title: String(data.title || file),
    full_title: data.full_title ? String(data.full_title) : undefined,
    section: data.section ? String(data.section) : undefined,
    parent: data.parent ? slugify(String(data.parent)) : undefined,
    body: content,
    blocks: Array.isArray(data.blocks) ? (data.blocks as PageBlock[]).filter((b) => b?.type) : [],
    gallery: Array.isArray(data.gallery) ? data.gallery.filter((g: GalleryItem) => g?.image) : [],
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    seo_title: data.seo_title,
    seo_description: data.seo_description,
  }))
  pagesCache = ensureUniqueSlugs(pagesCache, "content/pages")
  return pagesCache
}

export function getPageBySlug(slug: string): PageItem | undefined {
  return getAllPages().find((p) => p.slug === slug)
}

let certificatesCache: CertificateItem[] | null = null

export function getAllCertificates(): CertificateItem[] {
  if (isProd && certificatesCache) return certificatesCache
  const items = readMd("certificates").map(({ file, data }) => {
    const rows = Array.isArray(data.rows)
      ? data.rows
          .map((r: { cells?: unknown[] }) => ({ cells: (r?.cells ?? []).map((c) => String(c ?? "")) }))
          .filter((r: { cells: string[] }) => r.cells.some((c) => c.trim()))
      : []
    /*
      Дата тут необов'язкова, і саме тому не через parseDate: той у разі
      негодящого значення підставляє 1970 рік, і перелік стрибав би в кінець
      списку. Краще лишити його без дати — тоді він піде за назвою.
    */
    let date: string | undefined
    if (data.date) {
      const d = new Date(data.date as string)
      if (!Number.isNaN(d.getTime())) date = d.toISOString()
      else console.warn(`[content] Нечитна дата у content/certificates/${file}: ${JSON.stringify(data.date)}`)
    }
    return {
      slug: slugify(file.replace(/\.md$/, "")),
      title: String(data.title || file),
      date,
      event: data.event ? String(data.event) : undefined,
      columns: Array.isArray(data.columns) ? data.columns.map(String) : [],
      rows,
    }
  })
  items.sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : -1
    if (a.date) return -1
    if (b.date) return 1
    return a.title.localeCompare(b.title, "uk")
  })
  certificatesCache = ensureUniqueSlugs(items, "content/certificates")
  return certificatesCache
}

export function getCertificateBySlug(slug: string): CertificateItem | undefined {
  return getAllCertificates().find((c) => c.slug === slug)
}

export function getTeam(): TeamMember[] {
  return readMd("team")
    .map(({ data, content }) => ({
      name: String(data.name || ""),
      position: String(data.position || ""),
      photo: data.photo ? String(data.photo) : undefined,
      order: Number(data.order ?? 99),
      bio: content.trim() || undefined,
    }))
    .sort((a, b) => a.order - b.order)
}

function readYaml<T>(file: string, fallback: T): T {
  const full = path.join(CONTENT_DIR, "settings", file)
  if (!fs.existsSync(full)) return fallback
  return (yaml.load(fs.readFileSync(full, "utf-8")) as T) ?? fallback
}

export function getSiteSettings(): SiteSettings {
  const raw = readYaml<Partial<SiteSettings>>("site.yml", {})
  return {
    site_name: raw.site_name || "Центр професійного розвитку педагогічних працівників",
    site_short_name: raw.site_short_name || "ЦПРПП м. Лубни",
    site_description: raw.site_description || "",
    logo: raw.logo,
    logo_emblem: raw.logo_emblem,
    tagline: raw.tagline || [],
    address: raw.address,
    map_url: raw.map_url,
    phones: raw.phones || [],
    email: raw.email,
    consultation_url: raw.consultation_url,
    schedule: raw.schedule || [],
    partners: raw.partners || [],
  }
}

export function getNavigation(): NavSection[] {
  const raw = readYaml<{ sections?: NavSection[] }>("navigation.yml", {})
  return raw.sections || []
}
