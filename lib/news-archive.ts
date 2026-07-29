import { getAllNews, getNewsYears, type NewsItem } from "@/lib/content"

export const PER_PAGE = 24

export interface ArchiveView {
  items: NewsItem[]
  /** Скільки всього публікацій у вибірці (не на сторінці) */
  total: number
  page: number
  totalPages: number
  year: string | null
}

/**
 * Адреси архіву навмисно без query-параметрів: сторінка з searchParams
 * рендериться на сервері під кожен запит, а так увесь архів
 * попередньо збирається у статику й віддається з CDN.
 *
 *   /novyny                        усі новини, перша сторінка
 *   /novyny/storinka/3             усі новини, третя сторінка
 *   /novyny/rik/2024               2024 рік, перша сторінка
 *   /novyny/rik/2024/storinka/2    2024 рік, друга сторінка
 */
export function archiveHref(year: string | null, page: number): string {
  const base = year ? `/novyny/rik/${year}` : "/novyny"
  return page > 1 ? `${base}/storinka/${page}` : base
}

export function getArchiveView(year: string | null, page: number): ArchiveView {
  const all = getAllNews()
  const filtered = year ? all.filter((n) => n.date.startsWith(year)) : all
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const current = Math.min(Math.max(1, page), totalPages)
  return {
    items: filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE),
    total: filtered.length,
    page: current,
    totalPages,
    year,
  }
}

/** Кількість сторінок у вибірці — для generateStaticParams */
export function countPages(year: string | null): number {
  const all = getAllNews()
  const filtered = year ? all.filter((n) => n.date.startsWith(year)) : all
  return Math.max(1, Math.ceil(filtered.length / PER_PAGE))
}

/** Усі роки, за якими є публікації */
export const archiveYears = getNewsYears
