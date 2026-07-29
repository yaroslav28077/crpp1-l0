/**
 * Переведення списків посилань із Markdown у блок «Документи».
 *
 * Після переходу на блоки розділи на кшталт «Документи» лишилися звичайним
 * Markdown: щоб додати наказ, редактор мусив зробити пункт списку, виділити
 * текст і натиснути кнопку посилання. Блок «Документи» дає замість цього два
 * поля — «Назва» і «Посилання».
 *
 * Конвертуються лише блоки, де МОЖНА зробити це без втрат: усі пункти —
 * чисті посилання виду `- [назва](адреса)`, а поза списком трапляються хіба
 * що заголовки років (`#### 2025 рік`) або горизонтальні лінії.
 *
 * Заголовок усередині списку стає окремим блоком «Документи» — так роки
 * видно як окремі згортувані розділи, а не як один довгий перелік.
 * Горизонтальні лінії були суто оформленням і зникають: рік і так написаний
 * у назві кожного документа.
 *
 * Блоки з таблицями, вкладеними списками чи прозою лишаються Markdown —
 * там форма з двох полів вміст би втратила.
 *
 * Запуск: node scripts/lists-to-documents.mjs [--apply]
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const PAGES = path.join(process.cwd(), "content", "pages")
const APPLY = process.argv.includes("--apply")
const engines = { yaml: { stringify: (o) => yaml.dump(o, { lineWidth: 1000 }), parse: yaml.load } }

const LINK = /^[-*]\s+\[([^\]]+)\]\((\S+)\)\s*$/
const RULE = /^-{3,}$/
const HEADING = /^#{1,6}\s+(.+)$/

/** Чи можна перевести блок без втрат */
function analyse(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return null

  const segments = []
  let current = { heading: null, items: [] }
  let sawLink = false

  for (const line of lines) {
    if (LINK.test(line)) {
      const [, label, url] = line.match(LINK)
      current.items.push({ label: label.trim(), url })
      sawLink = true
      continue
    }
    if (RULE.test(line)) continue // суто оформлення
    const h = line.match(HEADING)
    if (h) {
      if (current.items.length) segments.push(current)
      current = { heading: h[1].trim(), items: [] }
      continue
    }
    return null // будь-що інше — не чіпаємо
  }
  if (current.items.length) segments.push(current)
  if (!sawLink || !segments.length) return null
  return segments
}

const report = []

for (const file of fs.readdirSync(PAGES).filter((f) => f.endsWith(".md")).sort()) {
  const full = path.join(PAGES, file)
  const { data, content } = matter(fs.readFileSync(full, "utf-8"))
  const blocks = data.blocks || []
  const next = []
  let changed = false

  for (const block of blocks) {
    if (block.type !== "accordion" && block.type !== "text") {
      next.push(block)
      continue
    }
    const segments = analyse(block.text)
    if (!segments) {
      next.push(block)
      continue
    }
    // Розділ був згортуваним — лишаємо згортуваним і далі
    const collapsed = block.type === "accordion"
    segments.forEach((seg, i) => {
      next.push({
        type: "documents",
        title: seg.heading || (i === 0 ? block.title || "Документи" : "Документи"),
        collapsed,
        items: seg.items,
      })
    })
    changed = true
    report.push({
      file: file.replace(/\.md$/, ""),
      from: block.title || "текст",
      blocks: segments.length,
      links: segments.reduce((s, x) => s + x.items.length, 0),
    })
  }

  if (changed && APPLY) {
    fs.writeFileSync(full, matter.stringify(content, { ...data, blocks: next }, { engines }))
  }
}

const totalBlocks = report.reduce((s, r) => s + r.blocks, 0)
const totalLinks = report.reduce((s, r) => s + r.links, 0)
console.log(`${APPLY ? "Переведено" : "Буде переведено"}: ${report.length} блоків Markdown → ${totalBlocks} блоків «Документи», ${totalLinks} посилань`)
for (const r of report) {
  console.log(`  ${r.file.slice(0, 40).padEnd(41)} «${r.from}» → ${r.blocks} блок(ів), ${r.links} посилань`)
}
if (!APPLY) console.log("\nЗапустіть з --apply, щоб записати.")
