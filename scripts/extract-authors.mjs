/**
 * Винесення підпису автора з тексту новини в окреме поле.
 *
 * На старому сайті підпис оформлювали таблицею з однієї клітинки в кінці
 * тексту: `| Консультант ЦПРПП Світлана ЛІСНА |`. Так він і мігрував — тобто
 * у редакторі новини наприкінці стоїть таблиця, яку легко зачепити й зламати,
 * а створюючи нову новину, її треба відтворювати вручну.
 *
 * Скрипт переносить такий підпис у поле `author`. Сайт показує його окремим
 * рядком під текстом, однаково в усіх новинах.
 *
 * Переносяться лише беззаперечні випадки: у самому кінці тексту стоїть
 * таблиця з одного стовпця, без зображень і посилань усередині. Таблиці з
 * даними (розклади навчань) і мішанина з фото лишаються в тексті.
 *
 * Запуск: node scripts/extract-authors.mjs [--apply]
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const NEWS = path.join(process.cwd(), "content", "news")
const APPLY = process.argv.includes("--apply")
const engines = { yaml: { stringify: (o) => yaml.dump(o, { lineWidth: 1000 }), parse: yaml.load } }

const SEPARATOR = /^\|[\s\-:|]+\|$/

/**
 * Повертає { author, body } якщо в кінці тексту стоїть таблиця-підпис,
 * інакше null.
 */
function extract(body) {
  const lines = body.split("\n")
  // відкидаємо порожні рядки з кінця
  let end = lines.length
  while (end > 0 && !lines[end - 1].trim()) end--

  // збираємо суцільний блок табличних рядків у кінці
  let start = end
  while (start > 0 && lines[start - 1].trim().startsWith("|")) start--
  if (start === end) return null

  const block = lines.slice(start, end).map((l) => l.trim())
  const rows = block.filter((l) => !SEPARATOR.test(l))
  if (!rows.length) return null

  // лише один стовпець у кожному рядку
  if (rows.some((r) => (r.match(/\|/g) || []).length !== 2)) return null
  // без зображень і посилань — це вже не підпис
  if (rows.some((r) => /!\[|\]\(/.test(r))) return null

  const author = rows
    .map((r) => r.replace(/^\|/, "").replace(/\|$/, "").trim())
    .filter(Boolean)
    .join("\n")
  if (!author || author.length > 300) return null

  return { author, body: lines.slice(0, start).join("\n").trimEnd() }
}

let changed = 0
const samples = []

for (const file of fs.readdirSync(NEWS).filter((f) => f.endsWith(".md")).sort()) {
  const full = path.join(NEWS, file)
  const { data, content } = matter(fs.readFileSync(full, "utf-8"))
  if (data.author) continue

  const res = extract(content)
  if (!res) continue

  changed++
  if (samples.length < 8) samples.push(`${file.slice(0, 46).padEnd(47)} → ${res.author.replace(/\n/g, " / ").slice(0, 55)}`)

  if (APPLY) {
    fs.writeFileSync(full, matter.stringify(res.body + "\n", { ...data, author: res.author }, { engines }))
  }
}

console.log(`${APPLY ? "Винесено" : "Буде винесено"} підписів: ${changed} із ${fs.readdirSync(NEWS).filter((f) => f.endsWith(".md")).length} новин`)
console.log("\nПриклади:")
samples.forEach((s) => console.log("  " + s))
if (!APPLY) console.log("\nЗапустіть з --apply, щоб записати.")
