/**
 * Брендові елементи з логотипа Центру.
 *
 * Емблема намальована для світлого тла: її текст і стрічка — темно-сині,
 * тобто рівно того ж кольору, що й поверхні шапки, героя та футера. Просто
 * поклавши її туди, ми отримали б назву установи, яка зливається з фоном.
 * Тому емблема завжди стоїть на світлій плашці — це водночас повторює
 * кремовий папір оригіналу.
 */

export function BrandEmblem({
  src,
  className = '',
}: {
  src: string
  className?: string
}) {
  return (
    <span
      /*
        Відступи навколо малюнка вже вбудовані у сам PNG (див.
        scripts/extract-brand.mjs), тож плашці досить мінімального padding —
        інакше поля подвоюються і емблема виглядає дрібною.
      */
      className={`inline-flex items-center justify-center rounded-2xl bg-background p-2 shadow-lg ${className}`}
    >
      {/*
        alt="" свідомо: назва установи є і в самій емблемі, і текстом поруч,
        тож озвучувати її двічі — лише шум для читача з екрана.
      */}
      <img src={src || '/placeholder.svg'} alt="" className="w-full h-auto" />
    </span>
  )
}

/**
 * Гасло «Натхнення • Мудрість • Успіх».
 * Ромби між словами повторюють роздільники на нижній дузі логотипа.
 */
export function BrandTagline({
  words,
  className = '',
}: {
  words: string[]
  className?: string
}) {
  if (words.length === 0) return null

  return (
    <p
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 font-heading font-semibold uppercase tracking-[0.18em] ${className}`}
    >
      {words.map((word, i) => (
        <span key={word} className="flex items-center gap-x-3">
          {/* Ромб-роздільник перед кожним словом, крім першого */}
          {i > 0 && <span className="size-1.5 rotate-45 bg-accent shrink-0" aria-hidden="true" />}
          {word}
        </span>
      ))}
    </p>
  )
}
