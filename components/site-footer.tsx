import Link from 'next/link'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import type { NavSection, SiteSettings } from '@/lib/content'
import { BrandEmblem, BrandTagline } from '@/components/brand'

export function SiteFooter({
  settings,
  navigation,
}: {
  settings: SiteSettings
  navigation: NavSection[]
}) {
  return (
    <footer className="bg-surface text-surface-foreground mt-16">
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-10 md:grid-cols-3">
        <div className="flex flex-col gap-4 items-start">
          {settings.logo_emblem ? (
            <BrandEmblem src={settings.logo_emblem} className="w-52" />
          ) : (
            <p className="font-heading font-bold text-lg text-balance">{settings.site_short_name}</p>
          )}
          <BrandTagline words={settings.tagline} className="text-xs opacity-90" />
          <p className="text-sm opacity-80 leading-relaxed">{settings.site_description}</p>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <p className="font-heading font-bold">Контакти</p>
          {settings.address && (
            <p className="flex items-start gap-2">
              <MapPin className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
              {settings.map_url ? (
                <a href={settings.map_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {settings.address}
                </a>
              ) : (
                settings.address
              )}
            </p>
          )}
          {settings.phones.map((phone) => (
            <p key={phone} className="flex items-center gap-2">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              {phone}
            </p>
          ))}
          {settings.email && (
            <a href={`mailto:${settings.email}`} className="flex items-center gap-2 hover:underline">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              {settings.email}
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <p className="font-heading font-bold flex items-center gap-2">
            <Clock className="size-4" aria-hidden="true" />
            Графік роботи
          </p>
          {settings.schedule.map((s) => (
            <p key={s.days} className="flex justify-between gap-4 max-w-52">
              <span className="opacity-80">{s.days}</span>
              <span>{s.hours}</span>
            </p>
          ))}
          <div className="mt-2 flex flex-col gap-1.5">
            <Link href="/novyny" className="hover:underline opacity-90">
              Новини
            </Link>
            <Link href="/komanda" className="hover:underline opacity-90">
              Наша команда
            </Link>
            <Link href="/my-spivpratsiuiemo" className="hover:underline opacity-90">
              Ми співпрацюємо
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-surface-border">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs opacity-70 flex flex-wrap justify-between gap-2">
          <p>
            {/*
              Без року: футер рендериться статично, тож new Date() зафіксував би
              рік збірки й показував би застаріле значення до наступного деплою.
            */}
            © {settings.site_short_name}. Усі права захищено.
          </p>
          {/*
            Свідомо звичайний <a>, а не <Link>: /admin — статичний HTML
            Decap CMS у public/, він живе поза роутером Next, тож клієнтська
            навігація для нього не працює. Без кінцевого слеша — інакше
            зайвий 308-редирект.
          */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin" className="hover:underline">
            Вхід для редакторів
          </a>
        </div>
      </div>
    </footer>
  )
}
