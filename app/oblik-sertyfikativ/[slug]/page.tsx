import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck } from 'lucide-react'
import { getAllCertificates, getCertificateBySlug, getPageBySlug } from '@/lib/content'
import { plural } from '@/components/page-blocks'

/** Сторінка-батько, на яку веде «Назад». Її адреса задана в контенті */
const PARENT = 'oblik-sertyfikativ'

/**
 * Назви стовпців тепер задані в коді, а не в кожному файлі: у всіх 75 переліках
 * вони були однакові з точністю до формулювання («Прізвище, ім'я слухача» /
 * «…, по батькові слухача»), а редактор мусив тримати їх порядок синхронним із
 * порядком клітинок. Тепер порядок гарантує код.
 */
const COLUMNS = [
  '№ з/п',
  'Прізвище, ім\u02bcя, по батькові слухача',
  'Форма проходження курсу підвищення кваліфікації',
  'Обсяг, кількість модулів (годин ЄКТС), тривалість',
  'Обліковий запис документа',
  'Дата видачі документа',
  'Результат проходження курсу підвищення кваліфікації',
]

export function generateStaticParams() {
  return getAllCertificates().map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const item = getCertificateBySlug(slug)
  if (!item) return {}
  return {
    title: item.title,
    description: item.event
      ? `Перелік виданих документів про підвищення кваліфікації. Захід: ${item.event}.`
      : 'Перелік виданих документів про підвищення кваліфікації.',
  }
}

export default async function CertificatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const item = getCertificateBySlug(slug)
  if (!item) notFound()

  const parent = getPageBySlug(PARENT)

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {parent && (
        <Link
          href={`/${parent.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {parent.title}
        </Link>
      )}

      <header className="mb-8">
        <p className="text-sm font-medium text-accent-foreground bg-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-3">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          Облік сертифікатів
        </p>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-balance leading-tight">{item.title}</h1>
        <p className="text-sm text-muted-foreground mt-3">
          {item.event ? `${item.event} · ` : ''}
          {item.entries.length} {plural(item.entries.length, 'запис', 'записи', 'записів')}
        </p>
      </header>

      {/*
        Таблиця широка (до семи стовпців), тож на телефоні гортається збоку.
        min-w обов'язковий: інакше вона стискається до ширини екрана й ПІБ
        ламається на два-три символи, а overflow-x-auto не спрацьовує ніколи.
      */}
      {/*
        Обрізаний край таблиці сам не підказує, що її можна гортати, а без
        останніх стовпців (номер документа, дата) сторінка марна. На широких
        екранах таблиця вміщається повністю, тож підказку там не показуємо.
      */}
      <p className="text-xs text-muted-foreground mb-2 lg:hidden">Таблиця гортається вбік</p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[48rem] text-sm border-collapse">
          <caption className="sr-only">{item.title}</caption>
          <thead>
            <tr className="bg-card border-b border-border">
              {COLUMNS.map((col) => (
                <th key={col} scope="col" className="text-left font-heading font-bold p-3 align-bottom">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.entries.map((entry, i) => (
              <tr key={i} className="border-b border-border last:border-0 align-top even:bg-card/50">
                {/*
                  Номер у контенті не зберігається: рахуємо з позиції, щоб він не
                  збивався, коли редактор вставляє або прибирає рядок посередині.
                */}
                <td className="p-3 leading-relaxed tabular-nums text-muted-foreground">{i + 1}.</td>
                <td className="p-3 leading-relaxed font-medium">{entry.name}</td>
                <td className="p-3 leading-relaxed">{entry.form}</td>
                <td className="p-3 leading-relaxed">{entry.volume}</td>
                <td className="p-3 leading-relaxed whitespace-nowrap">{entry.record}</td>
                <td className="p-3 leading-relaxed whitespace-nowrap">{entry.issued}</td>
                <td className="p-3 leading-relaxed">{entry.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
