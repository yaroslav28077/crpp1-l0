/**
 * Одноразове прибирання: перезаписати frontmatter усіх матеріалів із
 * lineWidth: -1.
 *
 * Скрипти міграції спершу дампили YAML із `lineWidth: 0`, а js-yaml трактує це
 * як «переносити де завгодно» — і кожне слово йшло з нового рядка через
 * складений скаляр `>-`. Зміст від цього не псується (складений скаляр
 * склеює рядки пробілами), але читати діф і правити файли руками неможливо.
 *
 * Запуск: node scripts/normalize-frontmatter.mjs
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const CONTENT = path.join(process.cwd(), "content")
let touched = 0, seen = 0

for (const dir of ["news", "pages", "certificates", "team"]) {
  const full = path.join(CONTENT, dir)
  if (!fs.existsSync(full)) continue
  for (const file of fs.readdirSync(full).filter((f) => f.endsWith(".md"))) {
    const p = path.join(full, file)
    const before = fs.readFileSync(p, "utf-8")
    const { data, content } = matter(before)
    seen++
    const fm = yaml.dump(data, { lineWidth: -1, noRefs: true, quotingType: '"' })
    const after = `---\n${fm}---\n\n${content.trim()}\n`.replace(/\n{3,}$/, "\n")
    if (after !== before) {
      fs.writeFileSync(p, after)
      touched++
    }
  }
}

console.log(`[normalize] Перевірено ${seen} файлів, перезаписано ${touched}`)
