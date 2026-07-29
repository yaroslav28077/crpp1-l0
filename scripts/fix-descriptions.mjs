/**
 * Перегенерація коротких описів новин.
 *
 * migrate.mjs робив `.slice(0, 160)` без урахування межі слова, тому 240 із 273
 * описів обривалися посеред слова («…педагогічних працівн»). Ці описи видно
 * і в картках новин, і в <meta name="description"> — тобто у видачі пошуковиків.
 *
 * Скрипт бере перший змістовний абзац тіла, чистить розмітку й обрізає
 * по межі слова. Файли, де опис уже нормальний, не чіпає.
 *
 * Запуск:  node scripts/fix-descriptions.mjs [--apply]
 * Без --apply лише показує, що буде змінено.
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const NEWS_DIR = path.join(process.cwd(), "content", "news")
const MAX_LEN = 160
const APPLY = process.argv.includes("--apply")

// gray-matter за замовчуванням загортає довгі рядки; lineWidth тримає формат,
// у якому вже записані решта файлів (перевірено: 257/273 round-trip байт-у-байт)
const engines = {
  yaml: { stringify: (o) => yaml.dump(o, { lineWidth: 1000 }), parse: yaml.load },
}

/** Чи виглядає опис обірваним посеред слова */
function isTruncated(desc) {
  if (!desc) return true
  const s = String(desc).trim()
  if (!s) return true
  return s.length >= MAX_LEN - 5 && !/[.!?…»)]$/.test(s)
}

/** Перший абзац тіла, придатний на опис */
function firstParagraph(body) {
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    // пропускаємо заголовки, таблиці, HTML, зображення, списки, цитати, роздільники
    if (/^(#|\||<|!\[|>|-{3,}|\*|\d+\.|-\s)/.test(line)) continue
    const clean = stripMarkdown(line)
    if (clean.length > 40) return clean
  }
  return ""
}

function stripMarkdown(s) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // зображення
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // посилання -> текст
    .replace(/<[^>]+>/g, "") // HTML-теги
    .replace(/[*_`]{1,3}/g, "") // жирний/курсив/код
    .replace(/\s+/g, " ")
    .trim()
}

/** Обрізати по межі слова, не розриваючи слово навпіл */
function truncateAtWord(text, max = MAX_LEN) {
  const s = text.trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  const base = (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut)
    // не лишати висячу кому/тире/дужку перед трикрапкою
    .replace(/[\s,;:—–\-(«"]+$/, "")
  return base + "…"
}

/**
 * Опис, який лише переказує заголовок, нічого не додає: у картці новини
 * той самий текст показувався б двічі, а пошуковики такий сніпет ігнорують.
 * Краще лишити опис порожнім — UI це коректно обробляє.
 */
const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()

function duplicatesTitle(desc, title) {
  const d = normalize(desc)
  const t = normalize(title)
  if (!d || !t) return false
  return t.includes(d) || d.includes(t)
}

const changes = []
const unresolved = []
const skippedAsTitle = []

for (const file of fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith(".md")).sort()) {
  const full = path.join(NEWS_DIR, file)
  const raw = fs.readFileSync(full, "utf-8")
  const { data, content } = matter(raw)

  if (!isTruncated(data.description)) continue

  const para = firstParagraph(content)
  if (!para) {
    unresolved.push(file)
    continue
  }

  const next = truncateAtWord(para)
  if (next === String(data.description || "").trim()) continue

  if (duplicatesTitle(next, data.title)) {
    skippedAsTitle.push(file)
    continue
  }

  changes.push({ file, before: String(data.description || "(порожньо)"), after: next })

  if (APPLY) {
    fs.writeFileSync(full, matter.stringify(content, { ...data, description: next }, { engines }))
  }
}

console.log(`${APPLY ? "Змінено" : "Буде змінено"} описів: ${changes.length}`)
if (unresolved.length) {
  console.log(`Без придатного тексту в тілі (лишаються без опису): ${unresolved.length}`)
  unresolved.forEach((f) => console.log(`   ${f}`))
}
if (skippedAsTitle.length) {
  console.log(`Опис лише переказував би заголовок — лишено порожнім: ${skippedAsTitle.length}`)
  skippedAsTitle.forEach((f) => console.log(`   ${f}`))
}
if (!APPLY) {
  console.log("\nПриклади:")
  for (const c of changes.slice(0, 5)) {
    console.log(`\n  ${c.file}`)
    console.log(`   було:  …${c.before.slice(-70)}`)
    console.log(`   стало: …${c.after.slice(-70)}`)
  }
  console.log("\nЗапустіть з --apply, щоб записати зміни.")
}
