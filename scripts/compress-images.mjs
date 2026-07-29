/**
 * Стискання мігрованих зображень: max 1600px по більшій стороні, JPEG quality 78.
 * PNG > 300КБ конвертуються без зміни формату (resize + оптимізація).
 * Запуск: node scripts/compress-images.mjs
 */
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const DIR = path.resolve(process.cwd(), "public/images")
const MAX_DIM = 1600
const JPEG_QUALITY = 78

let totalBefore = 0
let totalAfter = 0
let processed = 0
let failed = 0

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

async function processFile(file) {
  const ext = path.extname(file).toLowerCase()
  if (![".jpg", ".jpeg", ".png"].includes(ext)) return
  const stat = await fs.stat(file)
  totalBefore += stat.size
  if (stat.size < 60_000) {
    totalAfter += stat.size
    return // маленькі файли не чіпаємо
  }
  try {
    const img = sharp(file, { failOn: "none" })
    const meta = await img.metadata()
    let pipeline = img.rotate() // застосувати EXIF-орієнтацію
    if (Math.max(meta.width || 0, meta.height || 0) > MAX_DIM) {
      pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
    }
    let buf
    if (ext === ".png") {
      buf = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
    } else {
      buf = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
    }
    if (buf.length < stat.size) {
      await fs.writeFile(file, buf)
      totalAfter += buf.length
    } else {
      totalAfter += stat.size
    }
    processed++
    if (processed % 200 === 0) console.log(`[v0] ...оброблено ${processed}`)
  } catch (e) {
    failed++
    totalAfter += stat.size
    console.log(`[v0] Пропущено (помилка): ${file} — ${e.message}`)
  }
}

const files = []
for await (const f of walk(DIR)) files.push(f)
console.log(`[v0] Файлів: ${files.length}`)

const CONC = 8
const chunks = Array.from({ length: CONC }, (_, i) => files.filter((_, idx) => idx % CONC === i))
await Promise.all(chunks.map(async (chunk) => { for (const f of chunk) await processFile(f) }))

console.log(`[v0] Готово. Оброблено: ${processed}, помилок: ${failed}`)
console.log(`[v0] Було: ${(totalBefore / 1024 / 1024).toFixed(0)} МБ -> Стало: ${(totalAfter / 1024 / 1024).toFixed(0)} МБ`)
