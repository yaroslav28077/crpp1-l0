'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { GalleryItem } from '@/lib/content'

export function PhotoGallery({ items, title }: { items: GalleryItem[]; title?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length],
  )
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length],
  )

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [openIndex, close, prev, next])

  if (items.length === 0) return null

  return (
    <section aria-label={title || 'Фотогалерея'}>
      {title && <h2 className="font-heading text-xl font-bold mb-4">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {items.map((item, i) => (
          <button
            key={item.image + i}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="aspect-square overflow-hidden rounded-lg bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={item.caption || `Фото ${i + 1}, відкрити у повному розмірі`}
          >
            <img
              src={item.image || '/placeholder.svg'}
              alt={item.caption || ''}
              loading="lazy"
              className="size-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Перегляд фото"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
            aria-label="Закрити"
          >
            <X className="size-7" />
          </button>
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              className="absolute left-2 sm:left-6 p-2 text-white/80 hover:text-white"
              aria-label="Попереднє фото"
            >
              <ChevronLeft className="size-9" />
            </button>
          )}
          <figure className="max-w-5xl max-h-[85svh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={items[openIndex].image || '/placeholder.svg'}
              alt={items[openIndex].caption || ''}
              className="max-h-[78svh] max-w-full object-contain rounded-md"
            />
            <figcaption className="text-white/80 text-sm text-center">
              {items[openIndex].caption || `${openIndex + 1} з ${items.length}`}
            </figcaption>
          </figure>
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              className="absolute right-2 sm:right-6 p-2 text-white/80 hover:text-white"
              aria-label="Наступне фото"
            >
              <ChevronRight className="size-9" />
            </button>
          )}
        </div>
      )}
    </section>
  )
}
