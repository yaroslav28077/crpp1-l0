/**
 * Генерація public/_redirects — карти переходів зі старого сайту
 * lubny-cprpp.ho.ua (TiddlyWiki) на нові адреси.
 *
 * Старий сайт віддавав тіла нотаток окремими файлами /notes/<translit>.html,
 * де <translit> — заголовок тіддлера, пропущений через таблицю транслітерації
 * ArchivePlugin. Ці адреси проіндексовані пошуковиками і збережені в закладках;
 * без редиректів усі вони дають 404.
 *
 * Таблиця TW_TRANSLIT має збігатися з тією, за якою міграція завантажувала
 * нотатки (scripts/migrate.mjs) — інакше карта не збіжиться зі старими URL.
 *
 * Запуск: node scripts/generate-redirects.mjs
 *
 * УВАГА: редиректи спрацюють лише тоді, коли домен старого сайту почне
 * вказувати на цей Netlify-сайт. Якщо lubny-cprpp.ho.ua лишається окремо,
 * перенаправлення треба налаштовувати на його боці.
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"

const ROOT = process.cwd()
const CONTENT = path.join(ROOT, "content")

// Таблиця транслітерації ArchivePlugin (ідентична scripts/migrate.mjs)
const TW_TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ь: "", ы: "y", ъ: "",
  э: "e", ю: "yu", я: "ya", ґ: "g", і: "i", ї: "yi", є: "e", "’": "_",
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z", И: "I",
  Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T",
  У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "Ch", Ш: "Sh", Щ: "Sch", Ь: "", Ы: "Y", Ъ: "",
  Э: "E", Ю: "Yu", Я: "Ya", І: "I", Ї: "Yi", Є: "E",
  '"': "`", ":": "..", "–": "-", "«": "((", "»": "))", ";": ".,", "…": "...", "№": "$", "?": "^",
}

const twTranslit = (str) => [...str].map((c) => (c in TW_TRANSLIT ? TW_TRANSLIT[c] : c)).join("")

/** Стара адреса нотатки так, як вона виглядала в URL */
const oldNoteUrl = (title) => "/notes/" + encodeURIComponent(twTranslit(title) + ".html")

function readDir(dir) {
  const full = path.join(CONTENT, dir)
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data } = matter(fs.readFileSync(path.join(full, f), "utf-8"))
      return { file: f, data }
    })
}

/**
 * Заголовки тіддлерів, яких більше немає в контенті, але старі адреси мають
 * лишатися робочими. Сюди потрапляють дублікати, злиті в одну публікацію:
 * на старому сайті це були різні тіддлери (назви відрізнялися пробілом),
 * тож і адреси в них різні.
 */
const MERGED = [
  // Та сама нарада 22.10.2024; другий тіддлер мав помилкову дату створення 2022 р.
  { title: "Нарада заступників директорів ЗЗСО", to: "/novyny/2024-10-24-narada-zastupnykiv-dyrektoriv-zzso" },
]

const rules = []
const seen = new Map()
let collisions = 0

function addRule(from, to) {
  if (seen.has(from)) {
    if (seen.get(from) !== to) collisions++
    return
  }
  seen.set(from, to)
  rules.push({ from, to })
}

for (const { file, data } of readDir("news")) {
  const slug = file.replace(/\.md$/, "")
  addRule(oldNoteUrl(String(data.title)), `/novyny/${slug}`)
}

for (const { file, data } of readDir("pages")) {
  const slug = String(data.slug || file.replace(/\.md$/, ""))
  // На старому сайті файл нотатки називався за повним заголовком тіддлера,
  // а не за коротким ярликом меню — саме його зберігає full_title.
  const original = String(data.full_title || data.title)
  addRule(oldNoteUrl(original), `/${slug}`)
}

// Переліки виданих документів: на старому сайті кожен був окремою нотаткою.
for (const { file, data } of readDir("certificates")) {
  const slug = file.replace(/\.md$/, "")
  addRule(oldNoteUrl(String(data.title)), `/oblik-sertyfikativ/${slug}`)
}

for (const { title, to } of MERGED) addRule(oldNoteUrl(title), to)

/**
 * Назви, що не мають власної сторінки: місячні плани (тепер блоки на
 * /plany-roboty) та дублікати заголовків, які відрізнялися лише пробілами.
 * Карту готує scripts/restore-lost-content.mjs.
 */
const aliasFile = path.join(ROOT, "lib", "legacy-aliases.json")
if (fs.existsSync(aliasFile)) {
  const { aliases = {} } = JSON.parse(fs.readFileSync(aliasFile, "utf-8"))
  for (const [title, to] of Object.entries(aliases)) addRule(oldNoteUrl(title), to)
}

const out = {
  _comment: "Згенеровано scripts/generate-redirects.mjs — не редагувати вручну.",
  rules,
}

fs.writeFileSync(path.join(ROOT, "lib", "legacy-redirects.json"), JSON.stringify(out, null, 2) + "\n")

console.log(`Правил згенеровано: ${rules.length}`)
if (collisions) console.log(`Колізій (різні цілі для однієї старої адреси): ${collisions}`)
console.log("Записано: lib/legacy-redirects.json")
