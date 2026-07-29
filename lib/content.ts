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
  | { type: "news_by_topic"; title?: string; topic: string; extra?: string }
  /**
   * Список документів. Редактор заповнює «Назву» і «Посилання» в окремих
   * полях, а не робить посилання руками в Markdown.
   * `collapsed` — показувати згорнутим, як колишні розділи «Документи».
   */
  | {
      type: "documents"
      title?: string
      collapsed?: boolean
      items: { label: string; url?: string; file?: string }[]
    }
  /** Фотогалерея */
  | { type: "gallery"; title?: string; images: GalleryItem[] }

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
  /** Тіло старого формату. Лишається для сумісності; нові сторінки — у blocks */
  body: string
  blocks: PageBlock[]
  gallery: GalleryItem[]
  attachments: AttachmentItem[]
  seo_title?: string
  seo_description?: string
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
  /** Знак для шапки: лише символ логотипа, без тексту — його видно й на 44 px */
  logo?: string
  /**
   * Повна емблема з назвою та гаслом. Її текст темно-синій, тож на темних
   * поверхнях сайту вона стоїть на світлій плашці (див. components/brand.tsx).
   */
  logo_emblem?: string
  /** Герб Лубен — знак приналежності до громади, у нижній смузі футера */
  coat_of_arms?: string
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
    coat_of_arms: raw.coat_of_arms,
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
