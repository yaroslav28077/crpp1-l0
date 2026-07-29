/**
 * Переводить сторінки з ручного Markdown на структуровані блоки.
 *
 * Навіщо: розділи «Документи», переліки конкурсів і таблиці контактів
 * зберігалися як Markdown, тож щоб додати один наказ, секретарю треба було
 * знати синтаксис `- [назва](адреса)` і не збити відступи. Тепер для цього є
 * блоки «Перелік документів і посилань» і «Таблиця», де кожна назва й адреса
 * має власне поле. Цей скрипт розбирає наявний Markdown у ті блоки.
 *
 * Запуск: node scripts/blocks-from-markdown.mjs [--dry]
 * Без --dry перезаписує файли в content/pages.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import * as yaml from 'js-yaml'

const PAGES = path.join(process.cwd(), 'content', 'pages')
const DRY = process.argv.includes('--dry')

/** `- [назва](адреса)` або просто `- назва`, з урахуванням глибини відступу */
const ITEM = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/
const LINK = /^\[([^\]]+)\]\(([^)]+)\)\s*:?\s*$/
/** `![підпис](адреса)` — картинка */
const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)$/

/**
 * Ділить текст на смуги: суцільний список -> структурований перелік, усе
 * інше (абзаци, картинки) лишається Markdown-текстом.
 *
 * Одного «або-або» тут не досить: на сторінці «Проєкти» серед двох десятків
 * посилань стоїть одна картинка, і через неї ВЕСЬ перелік лишався ручним.
 * Тепер такий рядок відділяється в окремий текстовий блок, а решта
 * переліку стає полями.
 */
function segments(text) {
  const out = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const kind = ITEM.test(line) ? 'list' : 'text'
    const last = out[out.length - 1]
    if (last?.kind === kind) last.lines.push(line)
    else out.push({ kind, lines: [line] })
  }
  return out
}

/** Markdown-список -> items[] з вкладеністю за відступом */
function parseList(text) {
  const items = []
  for (const line of text.split('\n')) {
    const m = line.match(ITEM)
    if (!m) continue
    const [, indent, rest] = m
    const doc = {}
    const link = rest.match(LINK)
    if (link) {
      doc.label = link[1].trim()
      doc.url = link[2].trim()
    } else {
      // Рядок-заголовок групи: «Конкурс …:» — двокрапка в кінці зайва,
      // бо підпорядкованість тепер видно з самої структури
      doc.label = rest.replace(/\s*:\s*$/, '').trim()
    }
    // Відступ у 2+ пробіли означає вкладений наказ або додаток
    if (indent.length >= 2 && items.length > 0) {
      const parent = items[items.length - 1]
      parent.children = parent.children || []
      parent.children.push(doc)
    } else {
      items.push(doc)
    }
  }
  return items
}

/** Чи це Markdown-таблиця (рядки в риски, другий — розділювач `|---|`) */
function isTable(text) {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return false
  if (!lines.every((l) => l.trim().startsWith('|'))) return false
  return /^\|[\s:|-]+\|$/.test(lines[1].trim())
}

function parseTable(text) {
  const lines = text.split('\n').filter((l) => l.trim().startsWith('|'))
  const split = (l) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
  const columns = split(lines[0])
  // Другий рядок — розділювач, його пропускаємо
  const rows = lines.slice(2).map((l) => ({ cells: split(l) }))
  return { columns, rows }
}

/** Внутрішні посилання на новини зберігаємо як вибір публікації, а не адресу */
function linkToNews(doc) {
  const m = doc.url?.match(/^\/novyny\/(.+?)\/?$/)
  if (!m) return doc
  const { url, ...rest } = doc
  return { ...rest, news: m[1] }
}

function convertDoc(doc) {
  const out = linkToNews(doc)
  if (out.children) out.children = out.children.map(linkToNews)
  return out
}

let changed = 0
const report = []

for (const file of fs.readdirSync(PAGES).filter((f) => f.endsWith('.md'))) {
  const full = path.join(PAGES, file)
  const raw = fs.readFileSync(full, 'utf8')
  const { data, content } = matter(raw)
  if (!Array.isArray(data.blocks)) continue

  let touched = false
  const blocks = data.blocks.flatMap((block) => {
    const text = typeof block.text === 'string' ? block.text : ''
    if ((block.type !== 'accordion' && block.type !== 'text') || !text.trim()) return [block]
    const title = block.title ?? '—'
    // Колишній акордеон лишається згорнутим, а звичайний текст — розкритим:
    // вигляд сторінок від міграції не змінюється
    const view = block.type === 'accordion' ? 'collapsed' : 'open'

    if (isTable(text)) {
      const { columns, rows } = parseTable(text)

      // Таблиця з одних картинок і без рядків — це фоторяд, а не таблиця
      // (так на старому сайті верстали портрети команди)
      const images = columns.map((c) => c.match(IMAGE)).filter(Boolean)
      if (rows.length === 0 && images.length === columns.length && images.length > 0) {
        touched = true
        report.push(`${file}: фоторяд «${title}» -> галерея з ${images.length} фото`)
        return [
          {
            type: 'gallery',
            title: block.title,
            images: images.map((m) => ({ image: m[2], caption: m[1] || undefined })),
          },
        ]
      }

      // Порожню таблицю не створюємо: сторінка показала б нічого
      if (rows.length > 0) {
        touched = true
        report.push(`${file}: таблиця «${title}» -> ${rows.length} рядків`)
        return [{ type: 'table', title: block.title, view, columns, rows }]
      }
      return [block]
    }

    const parts = segments(text)
    if (!parts.some((p) => p.kind === 'list')) return [block]

    /*
      Акордеон дробити не можна: заголовок є лише в нього одного, тож
      наступні смуги вийшли б із-під згорнутого розділу назовні й
      розсипали б сторінку. Такі змішані розділи лишаємо Markdown —
      структуруємо тільки ті, що складаються з одного суцільного списку.
    */
    if (block.type === 'accordion' && parts.length > 1) {
      report.push(`${file}: «${title}» лишено як є — текст і список перемішані`)
      return [block]
    }
    touched = true

    return parts.map((part, idx) => {
      // Заголовок дістається лише першому блоку, інакше він повторився б
      const partTitle = idx === 0 ? block.title : undefined
      if (part.kind === 'text') {
        report.push(`${file}: «${title}» -> ${part.lines.length} рядк(ів) лишилися текстом`)
        // Без заголовка акордеон показав би порожній рядок замість назви,
        // тож смуги після першої стають звичайним текстом
        return partTitle
          ? { type: block.type, title: partTitle, text: part.lines.join('\n') }
          : { type: 'text', text: part.lines.join('\n') }
      }
      const items = parseList(part.lines.join('\n')).map(convertDoc)
      const nested = items.filter((i) => i.children?.length).length
      report.push(
        `${file}: перелік «${title}» -> ${items.length} рядків` +
          (nested ? `, з них ${nested} з вкладеними` : ''),
      )
      return { type: 'documents', title: partTitle, view, items }
    })
  })

  if (!touched) continue
  changed++
  if (DRY) continue

  // Порядок ключів у YAML лишаємо як був, щоб різниця в git була читною
  const front = yaml.dump({ ...data, blocks }, { lineWidth: -1, noRefs: true })
  fs.writeFileSync(full, `---\n${front}---\n${content}`)
}

console.log(report.join('\n'))
console.log(`\n${DRY ? 'Було б змінено' : 'Змінено'} сторінок: ${changed}`)
