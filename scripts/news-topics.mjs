/**
 * Переведення списків «Події» на автоматичне збирання.
 *
 * Досі після кожної публікації хтось мав вручну додати посилання на неї в
 * акордеон «Події» потрібної сторінки. Це систематично забувалося: у
 * «Дошкіллі» бракувало 12 профільних новин, на сторінці сертифікації —
 * навіть найсвіжішої «Сертифікація-2025».
 *
 * Скрипт проставляє новинам тему на підставі того, з яких сторінок на них
 * уже посилалися (це рішення людини, тож вміст не змінюється), і замінює
 * акордеон на блок, що збирає список сам.
 *
 * Пункти без посилання — сліди матеріалів, які не перенеслися зі старого
 * сайту, — зберігаються в полі extra під списком.
 *
 * Запуск: node scripts/news-topics.mjs [--apply]
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const ROOT = process.cwd()
const NEWS = path.join(ROOT, "content", "news")
const PAGES = path.join(ROOT, "content", "pages")
const APPLY = process.argv.includes("--apply")
const engines = { yaml: { stringify: (o) => yaml.dump(o, { lineWidth: 1000 }), parse: yaml.load } }

const isEvents = (b) => b.type === "accordion" && /^Поді/i.test(b.title || "")

/** slug новини -> набір тем */
const topicsBySlug = new Map()
/** що зробити зі сторінками */
const pageEdits = []

for (const file of fs.readdirSync(PAGES).filter((f) => f.endsWith(".md")).sort()) {
  const full = path.join(PAGES, file)
  const { data, content } = matter(fs.readFileSync(full, "utf-8"))
  const blocks = data.blocks || []
  const idx = blocks.findIndex(isEvents)
  if (idx === -1) continue

  const topic = String(data.slug || file.replace(/\.md$/, ""))
  const block = blocks[idx]
  const lines = String(block.text).split("\n")

  const linked = []
  const leftovers = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^[-*]\s+\[[^\]]*\]\((\/novyny\/[^)]+)\)\s*$/)
    if (m) {
      const slug = m[1].replace("/novyny/", "")
      linked.push(slug)
      if (!topicsBySlug.has(slug)) topicsBySlug.set(slug, new Set())
      topicsBySlug.get(slug).add(topic)
    } else {
      leftovers.push(raw)
    }
  }

  const next = { type: "news_by_topic", title: block.title, topic }
  if (leftovers.length) next.extra = leftovers.join("\n").trim()

  pageEdits.push({ file, full, data, content, idx, topic, linked: linked.length, leftovers: leftovers.length, next })
}

// ── запис ──
let newsChanged = 0
if (APPLY) {
  for (const [slug, topics] of topicsBySlug) {
    const p = path.join(NEWS, `${slug}.md`)
    if (!fs.existsSync(p)) continue
    const { data, content } = matter(fs.readFileSync(p, "utf-8"))
    const merged = [...new Set([...(data.topics || []), ...topics])].sort()
    if (JSON.stringify(merged) === JSON.stringify(data.topics || [])) continue
    fs.writeFileSync(p, matter.stringify(content, { ...data, topics: merged }, { engines }))
    newsChanged++
  }
  for (const e of pageEdits) {
    const blocks = [...e.data.blocks]
    blocks[e.idx] = e.next
    fs.writeFileSync(e.full, matter.stringify(e.content, { ...e.data, blocks }, { engines }))
  }
}

console.log(`${APPLY ? "Оброблено" : "Буде оброблено"} сторінок: ${pageEdits.length}`)
console.log(`Новин отримають тему: ${APPLY ? newsChanged : topicsBySlug.size}`)
console.log()
for (const e of pageEdits) {
  console.log(
    `  ${e.topic.slice(0, 38).padEnd(38)} новин: ${String(e.linked).padStart(3)}` +
      (e.leftovers ? `  + ${e.leftovers} пунктів без посилання збережено` : ""),
  )
}
if (!APPLY) console.log("\nЗапустіть з --apply, щоб записати.")
