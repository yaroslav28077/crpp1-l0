import type { Metadata } from 'next'
import { BookingForm } from '@/components/booking-form'

export const metadata: Metadata = {
  title: 'Запис на консультацію та до психолога',
  description:
    'Онлайн-запис до психолога Центру та на консультацію ЦПРПП м. Лубни. Залишіть контакти — ми зателефонуємо та узгодимо час.',
}

export default function ZapisPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <p className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
          Онлайн-запис
        </p>
        <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-balance md:text-4xl">
          Запис на консультацію та до психолога
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
          Заповніть форму — заявка одразу потрапить до Центру. Ми зателефонуємо вам і узгодимо зручний
          час. Зазвичай відповідаємо протягом робочого дня.
        </p>
      </header>
      <BookingForm />
    </main>
  )
}
