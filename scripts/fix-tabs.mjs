// Конвертує залишки TiddlyWiki-плагіна вкладок (<tabs X> ... <tab Назва> ... </tab> ... </tabs>)
// у стандартні HTML-блоки <details>/<summary>, які добре рендеряться з Markdown.
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
let fixed = 0

for (const dir of ["content/pages", "content/news"]) {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) continue
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith(".md")) continue
    const fp = path.join(full, f)
    let src = fs.readFileSync(fp, "utf-8")
    const before = src

    // <tab Назва> -> <details><summary>Назва</summary> + порожній рядок (щоб Markdown усередині рендерився)
    src = src.replace(/<tab ([^>]+)>\s*/g, (_, name) => `<details>\n<summary>${name.trim()}</summary>\n\n`)
    // </tab> -> </details>
    src = src.replace(/\s*<\/tab>/g, "\n\n</details>\n")
    // Обгортки <tabs ...> і </tabs> прибираємо повністю
    src = src.replace(/<\/?tabs[^>]*>\s*/g, "\n")

    if (src !== before) {
      fs.writeFileSync(fp, src)
      fixed++
    }
  }
}
console.log("Конвертовано файлів:", fixed)
