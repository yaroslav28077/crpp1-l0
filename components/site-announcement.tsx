/** Смуга-оголошення на всіх сторінках. Порожній текст — смуги немає. */
export function SiteAnnouncement({ text, url }: { text?: string; url?: string }) {
  const message = (text ?? '').trim()
  if (!message) return null

  return (
    // no-print: на папері оголошення про графік роботи ні до чого
    <aside
      className="no-print border-b border-accent bg-accent/20 px-4 py-2.5 text-center text-sm"
      aria-label="Оголошення"
    >
      {url ? (
        <a href={url} className="underline underline-offset-2 hover:no-underline">
          {message}
        </a>
      ) : (
        message
      )}
    </aside>
  )
}
