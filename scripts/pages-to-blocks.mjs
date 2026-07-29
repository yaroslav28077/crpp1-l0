/**
 * Переведення сторінок із суцільного Markdown на блоки.
 *
 * Навіщо: тіло сторінки містило сирі <details>/<summary> — розгортувані
 * розділи, успадковані від TiddlyWiki. Редактор без досвіду верстки не міг
 * їх чіпати, не зламавши: досить прибрати один тег, і сторінка розсипається.
 *
 * Блоки дають ті самі розділи як окремі поля в адмінці: заголовок і вміст
 * окремо, з можливістю додати, перейменувати чи переставити мишею.
 *
 * Вміст усередині розділів навмисно лишається Markdown і переноситься
 * дослівно: там трапляються таблиці, нумеровані списки й посилання, тож
 * будь-яке «розумне» розкладання по полях втратило б частину даних.
 *
 * Запуск:  node scripts/pages-to-blocks.mjs [--apply]
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const PAGES = path.join(process.cwd(), "content", "pages")
const APPLY = process.argv.includes("--apply")
const engines = { yaml: { stringify: (o) => yaml.dump(o, { lineWidth: 1000 }), parse: yaml.load } }

/**
 * Оголошення на сторінках записані як таблиця з одного стовпця:
 *   | **ОГОЛОШЕННЯ** |
 *   | --- |
 *   | текст |
 * Це верстка, а не дані, тож виносимо в окремий блок.
 */
function asNotice(md) {
  const lines = md.trim().split("\n").map((l) => l.trim())
  if (lines.length < 3 || !lines.every((l) => l.startsWith("|"))) return null
  const cells = lines
    .filter((l) => !/^\|\s*-{3,}\s*\|$/.test(l))
    .map((l) => l.replace(/^\|/, "").replace(/\|$/, "").trim())
  if (cells.length < 2) return null
  const [heading, ...rest] = cells
  const isSingleColumn = lines.every((l) => (l.match(/\|/g) || []).length === 2)
  if (!isSingleColumn) return null
  return { type: "notice", heading: heading.replace(/\*\*/g, "").trim(), text: rest.join("\n\n") }
}

function textBlocks(md) {
  const trimmed = md.trim()
  if (!trimmed) return []
  const notice = asNotice(trimmed)
  if (notice) return [notice]
  return [{ type: "text", text: trimmed }]
}

export function toBlocks(body) {
  const blocks = []
  const re = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g
  let last = 0
  let m
  while ((m = re.exec(body))) {
    blocks.push(...textBlocks(body.slice(last, m.index)))
    blocks.push({ type: "accordion", title: m[1].trim(), text: m[2].trim() })
    last = m.index + m[0].length
  }
  blocks.push(...textBlocks(body.slice(last)))
  return blocks
}

/** Зворотне складання — щоб довести, що нічого не загубилося */
export function blocksToMarkdown(blocks) {
  return blocks
    .map((b) => {
      if (b.type === "accordion") return `<details>\n<summary>${b.title}</summary>\n\n${b.text}\n\n</details>`
      if (b.type === "notice") {
        const rows = String(b.text).split("\n\n").filter(Boolean)
        return [`| **${b.heading}** |`, "| --- |", ...rows.map((r) => `| ${r} |`)].join("\n")
      }
      return b.text
    })
    .join("\n\n")
}

// Скрипт можна імпортувати заради toBlocks/blocksToMarkdown — тоді
// перетворення файлів не запускається
const runDirectly = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)
if (runDirectly) {

let changed = 0
const report = []

for (const file of fs.readdirSync(PAGES).filter((f) => f.endsWith(".md")).sort()) {
  const full = path.join(PAGES, file)
  const raw = fs.readFileSync(full, "utf-8")
  const { data, content } = matter(raw)
  if (Array.isArray(data.blocks)) continue // вже переведено

  const blocks = toBlocks(content)
  if (!blocks.length) continue

  const counts = blocks.reduce((a, b) => ({ ...a, [b.type]: (a[b.type] || 0) + 1 }), {})
  report.push({ file, counts })

  if (APPLY) {
    const next = { ...data, blocks }
    // тіло переїхало в блоки; лишати його порожнім, щоб не було двох джерел правди
    fs.writeFileSync(full, matter.stringify("", next, { engines }))
    changed++
  }
}

console.log(`Сторінок ${APPLY ? "переведено" : "буде переведено"}: ${report.length}`)
const totals = report.reduce((a, r) => {
  for (const [k, v] of Object.entries(r.counts)) a[k] = (a[k] || 0) + v
  return a
}, {})
console.log("Блоків за типами:", totals)
if (!APPLY) {
  console.log("\nПерші сторінки:")
  report.slice(0, 8).forEach((r) => console.log(`  ${r.file.replace(".md", "").padEnd(40)} ${JSON.stringify(r.counts)}`))
  console.log("\nЗапустіть з --apply, щоб записати.")
}

}
