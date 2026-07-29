import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center flex flex-col items-center gap-4">
      <p className="font-heading text-6xl font-bold text-primary">404</p>
      <h1 className="font-heading text-2xl font-bold">Сторінку не знайдено</h1>
      <p className="text-muted-foreground">Можливо, сторінку перенесено або видалено.</p>
      <Link href="/" className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-medium hover:opacity-90">
        На головну
      </Link>
    </main>
  )
}
