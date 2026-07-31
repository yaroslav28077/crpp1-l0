'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BadgeCheck, CalendarDays, FileText, Search as SearchIcon } from 'lucide-react'
import type { SearchDoc } from '@/lib/search-index'
import { formatDateUk } from '@/components/news-card'

const MAX_RESULTS = 60

/**
 * Пошук виконується в браузері за індексом, зібраним під час збірки.
 * Так сайт лишається статичним: не потрібні ні сервер, ні зовнішній сервіс.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    // ї/і, й/и та апостроф пишуть по-різному — зводимо до спільного вигляду,
    // щоб «мрія» знаходило «мрія» незалежно від набору
    .replace(/['’ʼ`]/g, '')
    .replace(/ё/g, 'е')
    // Номер документа переписують разом зі знаком: «№CPRPP2022/16». В індексі
    // він зберігається без нього, тож прибираємо — інакше збігу не буде
    .replace(/[№#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreDoc(doc: SearchDoc, terms: string[]): number {
  const title = normalize(doc.h)
  const body = normalize(doc.b)
  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += 10
    else if (body.includes(term)) score += 1
    else return 0 // слово не знайдено — документ не підходить
  }
  // за інших рівних новіші новини вище
  if (doc.d) score += 0.5
  return score
}

export function SearchResults() {
  const params = useSearchParams()
  const router = useRouter()
  const initial = params.get('q') ?? ''
  const [query, setQuery] = useState(initial)
  const [docs, setDocs] = useState<SearchDoc[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SearchDoc[]) => !cancelled && setDocs(d))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [])

  // Тримаємо адресу в актуальному стані, щоб результатами можна було поділитися
  useEffect(() => {
    const t = setTimeout(() => {
      const next = query.trim() ? `/poshuk?q=${encodeURIComponent(query.trim())}` : '/poshuk'
      router.replace(next, { scroll: false })
    }, 400)
    return () => clearTimeout(t)
  }, [query, router])

  const results = useMemo(() => {
    const terms = normalize(query).split(' ').filter((t) => t.length >= 2)
    if (!docs || terms.length === 0) return []
    return docs
      .map((doc) => ({ doc, score: scoreDoc(doc, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (b.doc.d || '').localeCompare(a.doc.d || ''))
      .slice(0, MAX_RESULTS)
  }, [docs, query])

  const trimmed = query.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < 2

  return (
    <>
      <label className="block mb-6">
        <span className="sr-only">Пошук по сайту</span>
        <div className="relative">
          <SearchIcon
            className="size-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Наприклад: прізвище, CPRPP2022/16, НУШ"
            autoFocus
            className="w-full rounded-xl border border-border bg-card pl-11 pr-4 py-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </div>
      </label>

      {failed && (
        <p className="text-muted-foreground py-8 text-center">
          Не вдалося завантажити пошуковий покажчик. Спробуйте оновити сторінку.
        </p>
      )}

      {!failed && !trimmed && (
        <p className="text-muted-foreground py-8 text-center">
          Введіть слово для пошуку — шукаємо серед новин, сторінок і переліків виданих документів. Свій
          документ про підвищення кваліфікації можна знайти за прізвищем або обліковим номером.
        </p>
      )}

      {!failed && tooShort && (
        <p className="text-muted-foreground py-8 text-center">Введіть щонайменше дві літери.</p>
      )}

      {!failed && trimmed.length >= 2 && docs === null && (
        <p className="text-muted-foreground py-8 text-center">Шукаємо…</p>
      )}

      {!failed && trimmed.length >= 2 && docs !== null && (
        <>
          <p className="text-sm text-muted-foreground mb-4" role="status">
            {results.length === 0
              ? 'Нічого не знайдено'
              : `Знайдено: ${results.length}${results.length === MAX_RESULTS ? ' (показано перші)' : ''}`}
          </p>
          <ul className="flex flex-col gap-3">
            {results.map(({ doc }) => (
              <li key={doc.u}>
                <Link
                  href={doc.u}
                  className="block rounded-xl border border-border bg-card p-4 hover:border-primary transition-colors"
                >
                  <span className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {doc.t === 'n' ? (
                      <>
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {doc.d ? formatDateUk(doc.d) : 'Новина'}
                      </>
                    ) : doc.t === 'c' ? (
                      // Перелік знаходять за прізвищем, тож підпис має відразу
                      // пояснювати, чому в результатах опинилася ця сторінка
                      <>
                        <BadgeCheck className="size-3.5" aria-hidden="true" />
                        Облік сертифікатів{doc.d ? ` · ${formatDateUk(doc.d)}` : ''}
                      </>
                    ) : (
                      <>
                        <FileText className="size-3.5" aria-hidden="true" />
                        {doc.s || 'Сторінка'}
                      </>
                    )}
                  </span>
                  <span className="font-heading font-bold block text-pretty">{doc.h}</span>
                  {doc.t === 'n' && doc.s && (
                    <span className="text-sm text-muted-foreground line-clamp-2 mt-1 block">{doc.s}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
