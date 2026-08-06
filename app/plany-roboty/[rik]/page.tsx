import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPlanMonthsByYear, getPlanYears } from '@/lib/content'
import { PlanMonthTables } from '@/components/page-blocks'

/*
  Плани роботи за один рік. До цього всі 62 місяці жили на /plany-roboty:
  1,88 МБ HTML і 1 898 рядків таблиць в одному документі. Сама /plany-roboty
  лишилась на місці й стала покажчиком років, тож старі посилання не побились.
*/
export function generateStaticParams() {
  return getPlanYears().map(({ year }) => ({ rik: year }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rik: string }>
}): Promise<Metadata> {
  const { rik } = await params
  if (getPlanMonthsByYear(rik).length === 0) return {}
  return {
    title: `Плани роботи на ${rik} рік`,
    description: `Плани роботи Центру професійного розвитку педагогічних працівників м. Лубни на ${rik} рік за місяцями.`,
  }
}

export default async function PlanYearPage({ params }: { params: Promise<{ rik: string }> }) {
  const { rik } = await params
  const months = getPlanMonthsByYear(rik)
  if (months.length === 0) notFound()

  const otherYears = getPlanYears().filter(({ year }) => year !== rik)

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/plany-roboty"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Плани роботи
      </Link>

      <header className="mb-8">
        <p className="text-sm font-medium text-accent-foreground bg-accent inline-block rounded-full px-3 py-1 mb-3">
          Діяльність Центру
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-balance">
          Плани роботи на {rik} рік
        </h1>
      </header>

      <PlanMonthTables months={months} />

      {otherYears.length > 0 && (
        <nav className="mt-10 rounded-xl border border-border bg-card p-5" aria-label="Плани роботи за інші роки">
          <h2 className="font-heading font-bold mb-3">Інші роки</h2>
          <ul className="flex flex-wrap gap-2">
            {otherYears.map(({ year }) => (
              <li key={year}>
                <Link
                  href={`/plany-roboty/${year}`}
                  className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary hover:bg-accent transition-colors"
                >
                  {year}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  )
}
