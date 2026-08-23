import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Заявку надіслано',
  robots: { index: false },
}

export default function DyakuiemoPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 sm:py-28">
      <div className="rounded-2xl border border-accent bg-accent/10 p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto size-14 text-primary" aria-hidden="true" />
        <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight">Дякуємо за звернення!</h1>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted-foreground">
          Вашу заявку отримано. Ми зателефонуємо вам протягом робочого дня й узгодимо зручний час.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-heading font-bold text-accent-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          На головну
        </Link>
      </div>
    </main>
  )
}
