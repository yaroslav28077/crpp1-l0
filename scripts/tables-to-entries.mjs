/**
 * Переведення table-блоків сторінок на іменовані поля.
 *
 * Було: `columns` + `rows.cells` — безіменні клітинки. В адмінці Decap рядок
 * показувався сирим масивом ["1","Перша гімназія…","Сергієнко Тетяна…"], а
 * всередині кожне поле звалося «Клітинка», тож редактор не бачив, де телефон,
 * а де пошта. Та сама проблема, що була в обліку сертифікатів.
 *
 * Стало: `fields` (яке поле в якому стовпці) + `entries` з іменами полів.
 * Шапка (`columns`) і порядок стовпців не змінюються, тож сторінка виглядає
 * так само. № з/п у даних не зберігається — на сайті він з індексу рядка.
 *
 * Запуск:
 *   node scripts/tables-to-entries.mjs                 # усі сторінки
 *   node scripts/tables-to-entries.mjs kerivnyi-sklad  # лише вибрані slug-и
 *
 * Скрипт ідемпотентний: блок із наявними `entries` не чіпається.
 */
import fs from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const DIR = path.resolve(process.cwd(), "content/pages")

/**
 * Назви стовпців зі старого сайту → імена полів. Порівнюємо за назвою, а не
 * за позицією: у «Керівниках ППС» ПІБ стоїть першим, а заклад — останнім.
 */
const FIELD_BY_COLUMN = [
  [/^\s*№/, null], // нумерація — не поле, а індекс рядка
  [/назва\s+заклад|заклад\s+освіти/i, "institution"],
  [/^\s*керівник\s+заклад/i, "person"],
  [/прізвище/i, "person"],
  [/керівник\s+професійної\s+спільноти|напрям\s+роботи|посада/i, "role"],
  [/телефон/i, "phone"],
  [/електронна\s+адреса|e-?mail|пошта/i, "email"],
  [/назва\s+заход/i, "event"],
  [/дата/i, "date"],
  [/відповідальн/i, "responsible"],
]

/**
 * Рядок-підпис під таблицею визначаємо за структурою, а не за текстом:
 * заповнена лише перша клітинка, решта порожні. У планах роботи таких рядків
 * 58 і написані вони тринадцятьма способами — «Директор ЦПРПП Надія СІЧКАР»,
 * «В.о. директора ЦПРПП   Оксана ПЕДОРЯКА», «В.о.директора Оксана ПЕДОРЯКА»
 * тощо, тож будь-який перелік ключових слів рано чи пізно щось загубить.
 */
function isNoteRow(cells) {
  const first = (cells[0] ?? "").trim()
  if (!first) return false
  if (cells.slice(1).some((c) => (c ?? "").trim())) return false
  // Самотній номер без даних — це порожній рядок, а не підпис
  return !/^\d+$/.test(first)
}

function fieldFor(column) {
  const name = String(column ?? "").trim()
  if (!name) return undefined
  for (const [re, field] of FIELD_BY_COLUMN) if (re.test(name)) return field
  return undefined
}

function convertBlock(block) {
  if (block?.type !== "table") return null
  if (Array.isArray(block.entries) && block.entries.length > 0) return null // уже переведено
  const columns = Array.isArray(block.columns) ? block.columns.map((c) => String(c ?? "")) : []
  const rows = Array.isArray(block.rows) ? block.rows : []
  if (columns.length === 0 || rows.length === 0) return null

  // Кожен непорожній стовпець мусить мати відповідник, інакше блок пропускаємо:
  // краще лишити старий формат, ніж загубити дані в невідомому стовпці.
  const mapped = columns.map((c) => ({ column: c, field: fieldFor(c) }))
  const fields = []
  for (const [i, m] of mapped.entries()) {
    if (i === 0 && /^\s*№/.test(m.column)) continue // № з/п — індекс
    if (!m.field) return { skipped: m.column }
    if (fields.includes(m.field)) return { skipped: `${m.column} (повторне поле ${m.field})` }
    fields.push(m.field)
  }
  if (fields.length === 0) return null

  const numbered = /^\s*№/.test(columns[0] ?? "")
  const entries = []
  for (const row of rows) {
    const cells = (Array.isArray(row?.cells) ? row.cells : []).map((c) => String(c ?? ""))
    if (cells.every((c) => !c.trim())) continue
    const values = numbered ? cells.slice(1) : cells
    // Підпис директора займав перший стовпець, решта клітинок була порожня
    if (isNoteRow(cells)) {
      entries.push({ note: cells[0].trim() })
      continue
    }
    const entry = {}
    fields.forEach((field, i) => {
      const value = (values[i] ?? "").trim()
      if (value) entry[field] = value
    })
    if (Object.keys(entry).length > 0) entries.push(entry)
  }
  if (entries.length === 0) return null
  return { fields, entries }
}

async function main() {
  const only = process.argv.slice(2)
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith(".md"))
  let changedFiles = 0
  let changedBlocks = 0
  const skipped = []

  for (const file of files) {
    const slug = file.replace(/\.md$/, "")
    if (only.length > 0 && !only.includes(slug)) continue
    const full = path.join(DIR, file)
    const parsed = matter(await fs.readFile(full, "utf8"))
    const blocks = Array.isArray(parsed.data.blocks) ? parsed.data.blocks : []
    let touched = false

    for (const block of blocks) {
      const result = convertBlock(block)
      if (!result) continue
      if (result.skipped) {
        skipped.push(`${slug}: ${block.title ?? "без назви"} — невідомий стовпець «${result.skipped}»`)
        continue
      }
      block.fields = result.fields
      block.entries = result.entries
      delete block.rows
      touched = true
      changedBlocks++
    }

    if (!touched) continue
    // lineWidth: -1 обов'язково: з 0 js-yaml ламає довгі рядки через >- і
    // кожне слово стає окремим рядком (та сама пастка, що в PR #3).
    // Решта опцій — як у scripts/normalize-frontmatter.mjs, щоб формат не стрибав.
    const fm = yaml.dump(parsed.data, { lineWidth: -1, noRefs: true, quotingType: '"' })
    const body = `---\n${fm}---\n\n${parsed.content.trim()}\n`.replace(/\n{3,}$/, "\n")
    await fs.writeFile(full, body)
    changedFiles++
    console.log(`[v0] ${slug}: переведено блоків — ${changedBlocks}`)
  }

  console.log(`[v0] Готово. Файлів: ${changedFiles}, блоків: ${changedBlocks}`)
  if (skipped.length > 0) {
    console.log(`[v0] Пропущено (лишились у старому форматі): ${skipped.length}`)
    for (const s of skipped) console.log(`[v0]   ${s}`)
  }
}

main()
