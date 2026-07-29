// Прибирає з frontmatter посилання на зображення, яких немає в public/
// (биті файли, що були 404 і на старому сайті)
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

const ROOT = process.cwd()
const PUBLIC = path.join(ROOT, "public")

function exists(p) {
  if (!p || !p.startsWith("/images/")) return true // зовнішні URL не чіпаємо
  return fs.existsSync(path.join(PUBLIC, decodeURIComponent(p)))
}

let fixedFiles = 0
for (const dir of ["content/news", "content/pages", "content/team"]) {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) continue
  for (const f of fs.readdirSync(full)) {
    if (!f.endsWith(".md")) continue
    const fp = path.join(full, f)
    const raw = fs.readFileSync(fp, "utf-8")
    const { data, content } = matter(raw)
    let changed = false

    // Галерея: лишаємо тільки наявні зображення
    if (Array.isArray(data.gallery)) {
      const before = data.gallery.length
      data.gallery = data.gallery.filter((g) => exists(typeof g === "string" ? g : g?.image))
      if (data.gallery.length !== before) changed = true
      if (data.gallery.length === 0) {
        delete data.gallery
        changed = true
      }
    }

    // Головне зображення: якщо биті — беремо перше з галереї або прибираємо
    if (data.image && !exists(data.image)) {
      const fromGallery = Array.isArray(data.gallery)
        ? data.gallery.map((g) => (typeof g === "string" ? g : g?.image)).find(Boolean)
        : null
      if (fromGallery) data.image = fromGallery
      else delete data.image
      changed = true
    }

    // Фото працівника
    if (data.photo && !exists(data.photo)) {
      delete data.photo
      changed = true
    }

    // Биті картинки в тілі: прибираємо markdown-зображення, що ведуть на неіснуючі файли
    let body = content
    body = body.replace(/!\[([^\]]*)\]\((\/images\/[^)]+)\)/g, (m, alt, src) => (exists(src) ? m : ""))
    if (body !== content) changed = true

    if (changed) {
      fs.writeFileSync(fp, matter.stringify(body, data))
      fixedFiles++
    }
  }
}
console.log("Виправлено файлів:", fixedFiles)
