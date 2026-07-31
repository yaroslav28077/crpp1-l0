/**
 * Переведення «Обліку сертифікатів» із безіменної таблиці на нормальні поля.
 *
 * Було: `columns: [7 назв]` + `rows: [{ cells: [7 значень] }]`. В адмінці це
 * давало сім однакових згорнутих рядків «Назва стовпця», а порядок клітинок
 * редактор мусив тримати синхронним зі стовпцями вручну. Для секретаря —
 * непрацездатно.
 *
 * Стало: `entries` — список слухачів із названими полями. Номер у таблиці
 * рахується автоматично з позиції, тож його ніхто не вписує.
 *
 * Значення «Форма», «Обсяг» і «Результат» усередині одного заходу зазвичай
 * однакові, тож найчастіше вживане виноситься на рівень переліку
 * (`default_form`, `default_volume`, `default_result`), а в записі лишається
 * лише те, що з нього вибивається. Заповнив три поля — далі вписуєш прізвища.
 *
 * Запуск: node scripts/certificates-to-entries.mjs
 * Скрипт ідемпотентний: файли, що вже мають `entries`, не змінюються.
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const DIR = path.join(process.cwd(), "content", "certificates")

/** Стовпець -> поле запису. Зіставляємо за початком назви: формулювання різнилися. */
const FIELD_BY_COLUMN = [
  [/^Прізвище/i, "name"],
  [/^Форма/i, "form"],
  [/^Обсяг/i, "volume"],
  [/^Обліковий/i, "record"],
  [/^Дата/i, "issued"],
  [/^Результат/i, "result"],
]

/**
 * «Форма проходження» писалася одинадцятьма способами: Офлайн / офлайн / очна /
 * очно / Онлайн / онлайн / Онлайн, офлайн / Онлайн/офлайн… Це три поняття, тож
 * зводимо до трьох значень — інакше випадайку в адмінці не зробити, а в таблиці
 * на сайті сусідні рядки виглядають по-різному без причини.
 */
export const FORMS = ["Офлайн", "Онлайн", "Змішана (онлайн + офлайн)"]

function normalizeForm(raw) {
  const s = String(raw || "").trim().toLowerCase()
  if (!s) return ""
  const online = /онлайн|дистанц/.test(s)
  const offline = /офлайн|очн/.test(s)
  if (online && offline) return FORMS[2]
  if (online) return FORMS[1]
  if (offline) return FORMS[0]
  return String(raw).trim()
}

/**
 * «Обсяг» писався то з комою, то з точкою в дробі («0,33» / «0.33»), інколи з
 * подвійними пробілами. Для людини це те саме значення, а для підрахунку
 * найчастішого — різні рядки, тож замовчування вибиралося неправильно.
 */
function normalizeVolume(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .trim()
}

/** Найчастіше значення в колонці — воно й піде за замовчуванням на весь перелік. */
function mode(values) {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  let best = "", bestN = 0
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n }
  // Заради одного-двох однакових значень виносити замовчування немає сенсу.
  return bestN >= 2 ? best : ""
}

let converted = 0, skipped = 0, entriesTotal = 0
const report = []

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort()) {
  const full = path.join(DIR, file)
  const { data, content } = matter(fs.readFileSync(full, "utf-8"))

  if (Array.isArray(data.entries)) { skipped++; continue }
  if (!Array.isArray(data.rows) || !Array.isArray(data.columns)) { skipped++; continue }

  const columns = data.columns.map((c) => String(c ?? "").trim())
  const index = {}
  columns.forEach((col, i) => {
    const hit = FIELD_BY_COLUMN.find(([re]) => re.test(col))
    if (hit && index[hit[1]] === undefined) index[hit[1]] = i
  })

  const raw = data.rows
    .map((r) => (r?.cells ?? []).map((c) => String(c ?? "").trim()))
    .filter((cells) => cells.some(Boolean))
    .map((cells) => {
      const at = (key) => (index[key] === undefined ? "" : cells[index[key]] || "")
      return {
        name: at("name").replace(/\s+/g, " "),
        form: normalizeForm(at("form")),
        volume: normalizeVolume(at("volume")),
        record: at("record").replace(/\s+/g, " "),
        issued: at("issued").replace(/\s+/g, " "),
        result: at("result").replace(/\s+/g, " "),
      }
    })
    // Порожні рядки-роздільники старої таблиці нам не потрібні.
    .filter((e) => e.name || e.record)

  const defaults = {
    form: mode(raw.map((e) => e.form)),
    volume: mode(raw.map((e) => e.volume)),
    result: mode(raw.map((e) => e.result)),
  }

  const entries = raw.map((e) => {
    const out = { name: e.name }
    // У записі лишаємо лише те, що відрізняється від значення переліку.
    for (const key of ["form", "volume"]) if (e[key] && e[key] !== defaults[key]) out[key] = e[key]
    if (e.record) out.record = e.record
    if (e.issued) out.issued = e.issued
    if (e.result && e.result !== defaults.result) out.result = e.result
    return out
  })

  const next = {
    title: data.title,
    ...(data.date ? { date: data.date } : {}),
    ...(data.event ? { event: data.event } : {}),
    ...(defaults.form ? { default_form: defaults.form } : {}),
    ...(defaults.volume ? { default_volume: defaults.volume } : {}),
    ...(defaults.result ? { default_result: defaults.result } : {}),
    entries,
  }

  fs.writeFileSync(
    full,
    `---\n${yaml.dump(next, { lineWidth: -1, noRefs: true, quotingType: '"' })}---\n\n${content.trim()}\n`.replace(/\n{3,}$/, "\n"),
  )
  converted++
  entriesTotal += entries.length
  const overrides = entries.reduce((s, e) => s + ["form", "volume", "result"].filter((k) => e[k]).length, 0)
  report.push({ file, entries: entries.length, overrides, defaults })
}

console.log(`[certificates] Переведено переліків: ${converted}, пропущено: ${skipped}`)
console.log(`[certificates] Записів про слухачів: ${entriesTotal}`)
const ov = report.reduce((s, r) => s + r.overrides, 0)
console.log(`[certificates] Полів-винятків (не збіглися зі значенням переліку): ${ov}`)
console.log(`[certificates] Тобто вручну заповнювати треба ~${Math.round((ov / Math.max(entriesTotal, 1)) * 100)}% додаткових полів`)
