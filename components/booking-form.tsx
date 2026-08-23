'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  FileText,
  HeartHandshake,
  Mail,
  Phone,
  Send,
  User,
} from 'lucide-react'

/**
 * Форма запису (Netlify Forms). Сторінка пререндериться, тож Netlify бачить
 * поля прямо в її статичному HTML — окремий прихований шаблон не потрібен.
 * Відправлення — звичайний POST: заявку кладе в дашборд Netlify, а він
 * (після підключення) дублює її на пошту. JS нижче — лише вибір напрямку,
 * відправлення через fetch і локальний стан «надіслано».
 */

type Kind = 'psykholoh' | 'konsultatsiia'

const KIND_LABELS: Record<Kind, string> = {
  psykholoh: 'Запис до психолога',
  konsultatsiia: 'Консультація фахівця Центру',
}

const inputBase =
  'w-full rounded-xl border border-border bg-card px-4 py-3 text-base leading-relaxed ' +
  'placeholder:text-muted-foreground/60 transition-colors duration-150 ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30'

const labelCls = 'mb-1.5 block text-sm font-medium'

export function BookingForm() {
  const [kind, setKind] = useState<Kind>('psykholoh')
  const [sent, setSent] = useState(false)

  return (
    <div className="flex flex-col gap-8">
      {/* Вибір напрямку — дві рівноправні картки */}
      <fieldset>
        <legend className={labelCls}>Куди записуєтесь</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => {
            const active = kind === k
            const Icon = k === 'psykholoh' ? HeartHandshake : FileText
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(k)}
                className={
                  'group flex items-center gap-3 rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ' +
                  (active
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-border bg-card hover:border-primary/50')
                }
              >
                <span
                  className={
                    'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ' +
                    (active ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground')
                  }
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-heading font-bold leading-snug">{KIND_LABELS[k]}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {sent ? (
        <section
          className="rounded-xl border border-accent bg-accent/10 p-6"
          role="status"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 font-heading text-lg font-bold">
            <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
            Заявку надіслано
          </p>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Дякуємо! Ми зателефонуємо вам протягом робочого дня й узгодимо зручний час.
          </p>
        </section>
      ) : (
        <form
          name="zapis"
          method="POST"
          data-netlify="true"
          netlify-honeypot="company"
          action="/dyakuiemo"
          onSubmit={(e) => {
            // Сторінка подяки статична, тож переходимо на неї без перезавантаження форми
            e.preventDefault()
            const form = e.currentTarget
            fetch('/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString(),
            }).then(() => setSent(true))
          }}
        >
          <input type="hidden" name="form-name" value="zapis" />
          <input type="hidden" name="napriamok" value={kind} />
          <p className="hidden">
            <label>
              Не заповнюйте це поле: <input name="company" tabIndex={-1} autoComplete="off" />
            </label>
          </p>

          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="name" className={labelCls}>
                Ваше імʼя та по батькові
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="name"
                  name="imia"
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  placeholder="Наталія Петрівна"
                  className={`${inputBase} pl-10`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className={labelCls}>
                Телефон
              </label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="phone"
                  name="telefon"
                  type="tel"
                  required
                  pattern="[0-9+()\-\s]{10,19}"
                  title="Наприклад: (067) 123-45-67"
                  autoComplete="tel"
                  placeholder="(067) 123-45-67"
                  className={`${inputBase} pl-10`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelCls}>
                Електронна пошта{' '}
                <span className="font-normal text-muted-foreground">(необовʼязково)</span>
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={`${inputBase} pl-10`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="reason" className={labelCls}>
                Коротко про причину звернення{' '}
                <span className="font-normal text-muted-foreground">(необовʼязково)</span>
              </label>
              <textarea
                id="reason"
                name="prychyna"
                rows={4}
                maxLength={1000}
                placeholder="Декілька слів, щоб ми могли підготуватися до розмови…"
                className={`${inputBase} resize-y`}
              />
            </div>

            <details className="rounded-xl border border-border bg-card">
              <summary className="cursor-pointer select-none px-4 py-3 font-heading font-semibold">
                Коли зателефонувати — якщо є побажання
              </summary>
              <div className="px-4 pb-4">
                <textarea
                  id="call-time"
                  name="chas_dzvinka"
                  rows={2}
                  maxLength={300}
                  placeholder="Наприклад: у будні після 15:00"
                  className={`${inputBase} resize-y`}
                />
              </div>
            </details>

            {/* Кнопка відправлення */}
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-heading font-bold text-accent-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            >
              <Send className="size-4" aria-hidden="true" />
              Надіслати заявку
            </button>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Натискаючи «Надіслати заявку», ви погоджуєтеся на обробку зазначених контактів для
              зворотного звʼязку. Дані бачать лише працівники Центру.
            </p>
          </div>
        </form>
      )}

      {/* Альтернатива без інтернету */}
      <aside className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed">
        <p className="font-heading font-bold">Зручніше телефоном?</p>
        <p className="mt-1 text-muted-foreground">
          Зателефонуйте нам:{' '}
          <a href="tel:+380536177416" className="text-primary underline underline-offset-2">
            (05361) 77-416
          </a>{' '}
          — або напишіть на{' '}
          <a href="mailto:lubny.cprpp@ukr.net" className="text-primary underline underline-offset-2">
            lubny.cprpp@ukr.net
          </a>
        </p>
      </aside>
    </div>
  )
}
