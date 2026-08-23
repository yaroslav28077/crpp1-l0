'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, X, Phone, Mail, Search } from 'lucide-react'
import type { NavSection, SiteSettings } from '@/lib/content'

export function SiteHeader({
  settings,
  navigation,
}: {
  settings: SiteSettings
  navigation: NavSection[]
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [openDesktop, setOpenDesktop] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  // Закривати меню при переході на іншу сторінку.
  // Скидаємо під час рендеру, а не в useEffect: так React не встигає
  // показати нову сторінку з відкритим меню й не робить зайвий прохід.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpenDesktop(null)
    setMobileOpen(false)
    setOpenSection(null)
  }

  // Закривати при кліку поза навігацією та по Escape
  useEffect(() => {
    if (!openDesktop) return
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDesktop(null)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenDesktop(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openDesktop])

  return (
    <header className="sticky top-0 z-50 bg-surface text-surface-foreground shadow-md">
      {/* Верхня смуга з контактами */}
      <div className="bg-black/25 text-sm">
        <div className="mx-auto max-w-6xl px-4 py-1.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 text-surface-foreground/85">
            {settings.phones[0] && (
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <Phone className="size-3.5" aria-hidden="true" />
                {settings.phones[0]}
              </span>
            )}
            {settings.email && (
              <a
                href={`mailto:${settings.email}`}
                className="hidden sm:flex items-center gap-1.5 hover:text-surface-foreground hover:underline min-w-0"
              >
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{settings.email}</span>
              </a>
            )}
          </div>
          {settings.consultation_url &&
            /* Внутрішня адреса (/zapis) — через Link без нової вкладки;
               зовнішня (Google Форма) — як була */
            (settings.consultation_url.startsWith('/') ? (
              <Link
                href={settings.consultation_url}
                className="rounded-full bg-accent text-accent-foreground px-3 py-0.5 font-medium whitespace-nowrap hover:opacity-90"
              >
                Запис на консультацію
              </Link>
            ) : (
              <a
                href={settings.consultation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-accent text-accent-foreground px-3 py-0.5 font-medium whitespace-nowrap hover:opacity-90"
              >
                Запис на консультацію
              </a>
            ))}
        </div>
      </div>

      {/* Логотип і назва */}
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          {settings.logo && (
            <img
              src={settings.logo || '/placeholder.svg'}
              alt=""
              className="size-11 object-contain shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-heading font-bold leading-tight text-sm sm:text-base text-balance">
              {settings.site_name}
            </p>
            <p className="text-xs text-surface-foreground/70 hidden sm:block">
              Лубенської міської ради Полтавської області
            </p>
          </div>
        </Link>
        <button
          type="button"
          className="lg:hidden p-2 rounded-md hover:bg-surface-muted"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Закрити меню' : 'Відкрити меню'}
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {/* Десктопна навігація */}
      {/*
        Смуга меню світліша за шапку — так головна навігація читається як окремий
        рівень, а не зливається з логотипом (кольори за референсом замовника).
      */}
      <nav
        ref={navRef}
        className="hidden lg:block bg-surface-nav border-t border-surface-border"
        aria-label="Головна навігація"
      >
        <div className="mx-auto max-w-6xl px-4 flex items-center">
          <Link
            href="/"
            className={`px-3 py-2.5 text-sm font-medium hover:text-accent ${
              pathname === '/' ? 'text-accent' : 'text-surface-foreground/85'
            }`}
          >
            Головна
          </Link>
          <Link
            href="/poshuk"
            className={`px-3 py-2.5 text-sm font-medium inline-flex items-center gap-1.5 hover:text-accent ${
              pathname === '/poshuk' ? 'text-accent' : 'text-surface-foreground/85'
            }`}
          >
            <Search className="size-3.5" aria-hidden="true" />
            Пошук
          </Link>
          {navigation.map((section) => {
            const isOpen = openDesktop === section.title
            const isActive = section.items.some((item) => item.url === pathname)
            return (
              <div
                key={section.title}
                className="relative"
                onMouseEnter={() => setOpenDesktop(section.title)}
                onMouseLeave={() => setOpenDesktop((s) => (s === section.title ? null : s))}
              >
                <button
                  type="button"
                  className={`px-3 py-2.5 text-sm font-medium flex items-center gap-1 hover:text-accent ${
                    isOpen || isActive ? 'text-accent' : 'text-surface-foreground/85'
                  }`}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpenDesktop(section.title)}
                >
                  {section.title}
                  <ChevronDown
                    className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="absolute left-0 top-full bg-surface-muted border border-surface-border rounded-lg shadow-xl py-2 min-w-64 z-50">
                    {section.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.url}
                        className={`block px-4 py-2 text-sm text-surface-foreground/85 hover:bg-surface hover:text-accent ${
                          item.url === pathname ? 'text-accent font-medium' : ''
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Мобільна навігація */}
      {mobileOpen && (
        <nav
          className="lg:hidden bg-surface-nav border-t border-surface-border max-h-[70svh] overflow-y-auto"
          aria-label="Мобільна навігація"
        >
          <div className="px-4 py-2 flex flex-col">
            <Link
              href="/"
              className="py-2.5 font-medium border-b border-surface-border"
              onClick={() => setMobileOpen(false)}
            >
              Головна
            </Link>
            <Link
              href="/poshuk"
              className="py-2.5 font-medium border-b border-surface-border flex items-center gap-2"
              onClick={() => setMobileOpen(false)}
            >
              <Search className="size-4" aria-hidden="true" />
              Пошук
            </Link>
            {navigation.map((section) => (
              <div key={section.title} className="border-b border-surface-border last:border-0">
                <button
                  type="button"
                  className="w-full py-2.5 font-medium flex items-center justify-between text-left"
                  onClick={() => setOpenSection((s) => (s === section.title ? null : section.title))}
                  aria-expanded={openSection === section.title}
                >
                  {section.title}
                  <ChevronDown
                    className={`size-4 transition-transform ${openSection === section.title ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {openSection === section.title && (
                  <div className="pb-2 flex flex-col">
                    {section.items.map((item) => (
                      <Link
                        key={item.label}
                        href={item.url}
                        className="py-2 pl-4 text-sm text-surface-foreground/75 hover:text-accent"
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
