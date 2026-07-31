/**
 * Відновлення контенту, який не перенісся під час першої міграції.
 *
 * Первинний scripts/migrate.mjs брав у роботу лише ті тіддлери, чиї назви є
 * прямими пунктами MainMenu. Усе, на що з тих сторінок ішли посилання
 * (місячні плани, методичні добірки предметних напрямків, окремі публікації),
 * лишилося на старому сайті. Крім того, конвертер вирізав макроси `<<...>>`,
 * тож зникли вкладки `<tabs>` — а саме в них жила вкладка «Документи».
 *
 * Що робить цей скрипт:
 *   1. Повертає посилання на документи, які були у вкладці «Документи»
 *      (предметні напрямки, творчі групи, фестиваль тощо).
 *   2. Наповнює «Плани роботи»: замість мертвих написів «січень, лютий…»
 *      підставляє таблиці планів по кожному місяцю 2021–2026.
 *   3. Відновлює публікації та довідкові сторінки, яких не було в меню.
 *   4. Дописує переліки виданих документів, що не потрапили в «Облік сертифікатів».
 *
 * Запуск: node scripts/restore-lost-content.mjs
 * Після нього обов'язково: node scripts/generate-redirects.mjs
 *
 * Скрипт ідемпотентний: повторний запуск не створює дублікатів.
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import * as yaml from "js-yaml"

const ROOT = process.cwd()
const CONTENT = path.join(ROOT, "content")
const SITE = "https://lubny-cprpp.ho.ua"
const CACHE = path.join(ROOT, ".cache-old-site")

// ─────────────── Транслітерація ArchivePlugin (як у migrate.mjs) ───────────────
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
const twTranslit = (s) => [...s].map((c) => (c in TW_TRANSLIT ? TW_TRANSLIT[c] : c)).join("")

const SLUG_MAP = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z",
  и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: "iu", я: "ia", ё: "e", ы: "y", э: "e", ъ: "",
}
function slugify(str) {
  return (
    [...str.toLowerCase()]
      .map((c) => (c in SLUG_MAP ? SLUG_MAP[c] : c))
      .join("")
      .replace(/['’"«»]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "page"
  )
}

const unescapeHtml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")

// ─────────────── Завантаження старого сайту (з кешем) ───────────────
async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (restore)" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

async function cached(key, loader) {
  fs.mkdirSync(CACHE, { recursive: true })
  const file = path.join(CACHE, key.replace(/[^\w.-]/g, "_").slice(0, 180))
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf-8")
  const text = await loader()
  fs.writeFileSync(file, text)
  return text
}

async function loadTiddlers() {
  const html = await cached("index.html", () => fetchText(SITE + "/"))
  const start = html.indexOf('id="storeArea"')
  const end = html.indexOf("<!--POST-STOREAREA-->")
  const store = html.slice(start, end === -1 ? undefined : end)
  const map = new Map()
  const re = /<div title="(.*?)"([^>]*)>\n?<pre>([\s\S]*?)<\/pre>\n?<\/div>/g
  let m
  while ((m = re.exec(store))) {
    const title = unescapeHtml(m[1])
    const attrs = m[2]
    map.set(title, {
      title,
      tags: unescapeHtml((attrs.match(/tags="(.*?)"/) || [, ""])[1]),
      created: (attrs.match(/created="(\d+)"/) || [, ""])[1],
      modified: (attrs.match(/modified="(\d+)"/) || [, ""])[1],
      body: unescapeHtml(m[3]),
    })
  }
  return map
}

async function resolveBody(t) {
  if (t.body.trim()) return t.body
  const fn = twTranslit(t.title) + ".html"
  try {
    return await cached(fn, () => fetchText(`${SITE}/notes/${encodeURIComponent(fn)}`))
  } catch {
    return ""
  }
}

// ─────────────── Транcклюзії <<tiddler X##Section>> ───────────────
/**
 * Старі плани роботи підтягували повторювані пункти з допоміжних тіддлерів
 * (`zhov##List1` тощо). migrate.mjs вирізав макроси разом із цим текстом —
 * у таблицях лишалися порожні комірки.
 */
function resolveTransclusions(text, tiddlers) {
  return text.replace(/<<tiddler\s+([^>\s]+?)(?:##(\w+))?\s*>>/g, (whole, name, section) => {
    const src = tiddlers.get(name)
    if (!src) return ""
    if (!section) return src.body
    const re = new RegExp(`^!${section}\\s*\\n([\\s\\S]*?)^!(?:end|\\w+)\\s*$`, "m")
    const hit = src.body.match(re)
    return hit ? hit[1].trim() : ""
  })
}

// ─────────────── Розбір вкладок <tabs>/<tab> ───────────────
function parseTabs(text) {
  const tabs = []
  const re = /<tab\s+([^>]+?)>\n?([\s\S]*?)<\/tab>/g
  let m
  while ((m = re.exec(text))) tabs.push({ title: m[1].trim(), body: m[2] })
  const outside = text.replace(/<tabs[^>]*>[\s\S]*?<\/tabs>/g, "").trim()
  return { tabs, outside }
}

// ─────────────── Списки посилань -> items блоку «Документи» ───────────────
function parseLinkList(text, titleToSlug) {
  const items = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line.startsWith("*")) continue
    const inner = line.replace(/^\*+\s*/, "")
    const m = inner.match(/^\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]$/)
    if (!m) continue
    const label = m[1].trim()
    const target = (m[2] || m[1]).trim()
    if (/^(https?:)/.test(target)) items.push({ label, url: target })
    else if (target.startsWith("//")) items.push({ label, url: "https:" + target })
    else {
      const slug = titleToSlug(target)
      items.push(slug ? { label, url: slug } : { label })
    }
  }
  return items
}

// ─────────────── Таблиця TiddlyWiki -> блок «Таблиця» ───────────────
function parseTwTable(text) {
  const lines = text.split("\n").filter((l) => /^\s*\|.*\|\s*[hcf]?\s*$/.test(l.trim()))
  if (lines.length < 2) return null
  const rows = lines.map((l) => {
    const trimmed = l.trim()
    const isHeader = /\|\s*h\s*$/.test(trimmed)
    const cells = trimmed
      .replace(/\|\s*[hcf]\s*$/, "|")
      .slice(1, -1)
      .split("|")
      .map((c) => c.replace(/^!/, "").replace(/^[><~]$/, "").trim())
    return { isHeader, cells }
  })
  const header = rows.find((r) => r.isHeader) || rows[0]
  const body = rows.filter((r) => r !== header)
  if (!body.length) return null
  const width = Math.max(header.cells.length, ...body.map((r) => r.cells.length))
  const pad = (c) => [...c, ...Array(Math.max(0, width - c.length)).fill("")]
  return {
    columns: pad(header.cells),
    rows: body.map((r) => ({ cells: pad(r.cells) })),
  }
}

// ─────────────── Інлайнова TW-розмітка -> Markdown ───────────────
function twInline(text, titleToSlug) {
  let t = text
  t = t.replace(/\/%[\s\S]*?%\//g, "")
  t = t.replace(/\{\{[\w-]+\{/g, "").replace(/\}\}\}/g, "")
  t = t.replace(/@@(?:[^@]*?;)?([^@]*?)@@/g, "$1")
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, label, target) => {
    label = label.trim()
    target = target.trim()
    if (/^(https?:|mailto:|\/)/.test(target)) return `[${label}](${target})`
    if (target.startsWith("//")) return `[${label}](https:${target})`
    const slug = titleToSlug(target)
    return slug ? `[${label}](${slug})` : label
  })
  t = t.replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
    target = target.trim()
    const slug = titleToSlug(target)
    return slug ? `[${target}](${slug})` : target
  })
  t = t.replace(/^(!{1,5})\s*(.+)$/gm, (_, b, x) => "#".repeat(b.length + 1) + " " + x.trim())
  t = t.replace(/''([^']+?)''/g, "**$1**")
  t = t.replace(/(^|[^:/])\/\/([^/\n][^/\n]*?)\/\//g, "$1*$2*")
  t = t.replace(/__([^_\n]+?)__/g, "<u>$1</u>")
  t = t.replace(/\^\^([^^\n]+?)\^\^/g, "<sup>$1</sup>")
  t = t.replace(/^(\*{1,4})\s*(.+)$/gm, (_, s, x) => "  ".repeat(s.length - 1) + "- " + x.trim())
  t = t.replace(/^-{4,}\s*$/gm, "\n---\n")
  t = t.replace(/<br\s*\/?>/gi, "\n")
  t = t.replace(/<\/?html>/gi, "\n")
  t = t.replace(/<<[\s\S]*?>>/g, "")
  return t.replace(/\n{3,}/g, "\n\n").trim()
}

const MONTHS = ["січень", "лютий", "березень", "квітень", "травень", "червень", "липень", "серпень", "вересень", "жовтень", "листопад", "грудень"]

const parseTwDate = (s) => {
  if (!s || s.length < 8) return null
  const [y, m, d] = [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)]
  const hh = s.length >= 12 ? s.slice(8, 10) : "12"
  const mm = s.length >= 12 ? s.slice(10, 12) : "00"
  return `${y}-${m}-${d}T${hh}:${mm}:00.000Z`
}

export {
  loadTiddlers, resolveBody, resolveTransclusions, parseTabs, parseLinkList,
  parseTwTable, twInline, slugify, twTranslit, parseTwDate, MONTHS, CONTENT,
}

// ══════════════════════════════════════════════════════════════════════════
//                                  ОСНОВНЕ
// ══════════════════════════════════════════════════════════════════════════

const PUBLIC = path.join(ROOT, "public")
const report = { documentsRestored: [], plansRestored: 0, newsCreated: [], pagesCreated: [], certificatesCreated: [], imagesFetched: 0, imagesMissing: [] }

/** Допоміжні тіддлери-фрагменти, теми та службові записи — не є сторінками. */
function isHelper(title, t) {
  if (/^[a-z0-9]{2,8}$/.test(title)) return true // zhov, trav, lyp, cherv, kvit, ver…
  if (/^\d{2}\.\d{2}\.\d{4}(\s*\(\d+\))?$/.test(title)) return true // «05.11.2024»
  if (/Plugin$|Theme$|Template$|^system|^Shablon|^Шаблон/i.test(title)) return true
  if (/systemConfig|systemTheme|Plugin|Шаблон|Посилання/i.test(t.tags)) return true
  if (/^(MainMenu|TopMenu|SiteTitle|SiteSubtitle|DefaultTiddlers|SiteUrl|StyleSheet|ColorPalette|MarkupPreHead|ToolbarCommands|EditTemplate|PageTemplate|ViewTemplate|SideBarOptions|SideBarTabs|OptionsPanel|AdvancedOptions|GettingStarted|WindowTitle|HoverMenu|BackgroundColors|SetTiddlerBackground|Кошик|͏)$/.test(title)) return true
  return false
}

const isTrash = (t) => /(^|\s)Кошик(\s|$)/.test(t.tags)
const isMonthlyPlan = (title) => /^План роботи\s+Центру професійного розвитку/i.test(title.replace(/\s+/g, " "))
const isCertList = (title) => /^Перелік виданих документів/i.test(title)
/**
 * Тег року («2024») чи місяця («Вересень2025») — ознака, що тіддлер був подією
 * стрічки, а не довідковою сторінкою. Саме за цими тегами старий сайт будував
 * «Календар подій».
 */
const isEvent = (t) =>
  /(^|\s)(20\d{2})(\s|$)/.test(t.tags) ||
  /(Січень|Лютий|Березень|Квітень|Травень|Червень|Липень|Серпень|Вересень|Жовтень|Листопад|Грудень)\d{4}/.test(t.tags)

/** Назви з різними пробілами/регістром — той самий матеріал. */
const normTitle = (s) => String(s).replace(/\s+/g, " ").trim().toLowerCase()

function readCollection(dir) {
  const full = path.join(CONTENT, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, ...matter(fs.readFileSync(path.join(full, f), "utf-8")) }))
}

/** Витягнути всі Google-ідентифікатори з тексту, щоб не дублювати посилання. */
function docIds(text) {
  const ids = new Set()
  for (const m of text.matchAll(/\/d\/([A-Za-z0-9_-]{10,})/g)) ids.add(m[1])
  for (const m of text.matchAll(/[?&]id=([A-Za-z0-9_-]{10,})/g)) ids.add(m[1])
  return ids
}

function writeMd(dir, name, data, body = "") {
  const file = path.join(CONTENT, dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const fm = yaml.dump(data, { lineWidth: -1, noRefs: true, quotingType: '"' })
  fs.writeFileSync(file, `---\n${fm}---\n\n${body}\n`)
  return file
}

/** Зображення старого сайту: pict/… та notes/… -> /images/… (з довантаженням). */
async function localImage(src) {
  const clean = decodeURIComponent(src.replace(/^\.?\//, "").split("?")[0].split("#")[0])
  if (!clean || /^https?:/.test(clean)) return src
  const rel = path.join("images", clean)
  const abs = path.join(PUBLIC, rel)
  if (!fs.existsSync(abs)) {
    try {
      const res = await fetch(`${SITE}/${clean.split("/").map(encodeURIComponent).join("/")}`, {
        headers: { "User-Agent": "Mozilla/5.0 (restore)" },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, Buffer.from(await res.arrayBuffer()))
      report.imagesFetched++
    } catch {
      report.imagesMissing.push(clean)
    }
  }
  return "/" + rel.split(path.sep).join("/")
}

/** Галерея старого сайту: <a href="notes/…/01.jpg" rel="iLoad|…"><img …></a> */
async function extractGallery(text) {
  const images = []
  const seen = new Set()
  for (const m of text.matchAll(/<a[^>]+href=["']([^"']+\.(?:jpe?g|png|gif|webp))["'][^>]*>/gi)) {
    if (!seen.has(m[1])) { seen.add(m[1]); images.push({ image: await localImage(m[1]) }) }
  }
  for (const m of text.matchAll(/\[img(?:\([^)]*\))?\[([^\]]+?)\]\]/g)) {
    const src = m[1].split("|").at(-1).trim()
    if (!seen.has(src)) { seen.add(src); images.push({ image: await localImage(src) }) }
  }
  for (const m of text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1]
    if (/^_|\/_/.test(src)) continue // мініатюри iLoad
    if (!seen.has(src)) { seen.add(src); images.push({ image: await localImage(src) }) }
  }
  return images
}

const stripMedia = (t) =>
  t
    .replace(/<a[^>]+rel=["']iLoad[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/<a[^>]+href=["'][^"']+\.(?:jpe?g|png|gif|webp)["'][^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/\[img(?:\([^)]*\))?\[[^\]]+\]\]/g, "")
    .replace(/<img[^>]*>/gi, "")

const describe = (md) => {
  const plain = md.replace(/[#*_>`\[\]()]/g, " ").replace(/\s+/g, " ").trim()
  return plain.length > 200 ? plain.slice(0, 197).replace(/\s+\S*$/, "") + "…" : plain
}

async function main() {
  console.log("[restore] Завантаження старого сайту…")
  const tiddlers = await loadTiddlers()
  console.log(`[restore] Тіддлерів: ${tiddlers.size}`)

  // Тіла нотаток лежать окремими файлами /notes/<translit>.html
  const needBody = [...tiddlers.values()].filter((t) => !t.body.trim() && !isHelper(t.title, t))
  for (const t of needBody) t.body = await resolveBody(t)
  for (const t of tiddlers.values()) t.body = resolveTransclusions(t.body, tiddlers)

  // ── Карта «назва тіддлера -> адреса на новому сайті» ──
  const pages = readCollection("pages")
  const news = readCollection("news")
  const certs = readCollection("certificates")
  const titleMap = new Map()
  const put = (title, url) => titleMap.set(normTitle(title), url)
  for (const p of pages) {
    put(p.data.title, "/" + p.data.slug)
    // На сайті заголовок скорочений («Стратегія розвитку»), а на старому сайті
    // тіддлер звався повною офіційною назвою — вона лежить у full_title.
    if (p.data.full_title) put(p.data.full_title, "/" + p.data.slug)
  }
  for (const n of news) put(n.data.title, "/novyny/" + n.file.replace(/\.md$/, ""))
  for (const c of certs) put(c.data.title, "/oblik-sertyfikativ/" + c.file.replace(/\.md$/, ""))
  put("Новини", "/novyny")
  const titleToSlug = (t) => titleMap.get(normTitle(t)) || null

  const usedPageSlugs = new Set(pages.map((p) => p.data.slug))
  const usedNewsSlugs = new Set(news.map((n) => n.file.replace(/\.md$/, "")))
  const usedCertSlugs = new Set(certs.map((c) => c.file.replace(/\.md$/, "")))
  const uniq = (base, used) => {
    let s = base, i = 2
    while (used.has(s)) s = `${base}-${i++}`
    used.add(s)
    return s
  }

  // ════════ 1. Повернути вкладки «Документи» на наявні сторінки ════════
  for (const page of pages) {
    const old = tiddlers.get(String(page.data.title).trim())
    if (!old || !old.body.includes("<tab ")) continue
    const { tabs } = parseTabs(old.body)
    const have = docIds(fs.readFileSync(path.join(CONTENT, "pages", page.file), "utf-8"))
    const blocks = Array.isArray(page.data.blocks) ? [...page.data.blocks] : []
    let added = 0
    for (const tab of tabs) {
      if (/^(Події|Заходи)$/i.test(tab.title)) continue
      // `----` розділяв добірки за навчальними роками
      const groups = tab.body.split(/^-{4,}\s*$/m).map((g) => parseLinkList(g, titleToSlug)).filter((g) => g.length)
      for (const [gi, items] of groups.entries()) {
        const fresh = items.filter((it) => {
          if (!it.url) return false
          const ids = docIds(it.url)
          return ![...ids].some((id) => have.has(id))
        })
        if (!fresh.length) continue
        fresh.forEach((it) => docIds(it.url).forEach((id) => have.add(id)))
        blocks.push({
          type: "documents",
          title: groups.length > 1 ? `${tab.title} (${gi + 1})` : tab.title,
          view: "collapsed",
          items: fresh,
        })
        added += fresh.length
      }
    }
    if (added) {
      writeMd("pages", page.file, { ...page.data, blocks }, page.content.trim())
      report.documentsRestored.push({ page: page.data.slug, added })
    }
  }

  // ════════ 2. Плани роботи: місячні таблиці замість мертвих написів ════════
  const plansFile = pages.find((p) => p.data.slug === "plany-roboty")
  const plansOld = tiddlers.get("Плани роботи")
  if (plansFile && plansOld) {
    const { tabs } = parseTabs(plansOld.body)
    const blocks = (plansFile.data.blocks || []).filter(
      (b) => !(b.type === "documents" && /^\d{4} рік$/.test(b.title || "")),
    )
    for (const tab of tabs) {
      const year = (tab.title.match(/\d{4}/) || [])[0]
      for (const raw of tab.body.split("\n")) {
        const m = raw.trim().match(/^\*+\s*\[\[([^\]|]+)\|([^\]]+)\]\]$/)
        if (!m) continue
        const month = m[1].trim()
        const target = tiddlers.get(m[2].trim())
        if (!target) continue
        const table = parseTwTable(target.body)
        if (!table) continue
        blocks.push({
          type: "table",
          title: `${month} ${year} року`,
          view: "collapsed",
          columns: table.columns,
          rows: table.rows.map((r) => ({ cells: r.cells.map((c) => twInline(c, titleToSlug)) })),
        })
        report.plansRestored++
      }
    }
    writeMd("pages", plansFile.file, { ...plansFile.data, blocks }, plansFile.content.trim())
  }

  // ════════ 3. Втрачені публікації та довідкові сторінки ════════
  /**
   * Старі адреси, для яких не буде власної сторінки: місячні плани тепер живуть
   * блоками на /plany-roboty, а частина тіддлерів відрізнялася лише подвійним
   * пробілом у назві. Щоб ці посилання не давали 404, віддаємо карту
   * generate-redirects.mjs.
   */
  const aliases = {}
  for (const t of tiddlers.values()) {
    const title = t.title.trim()
    if (isMonthlyPlan(title)) { aliases[title] = "/plany-roboty"; continue }
    if (isHelper(title, t) || isTrash(t)) continue
    const canonical = titleMap.get(normTitle(title))
    if (canonical) {
      if (!aliases[title]) aliases[title] = canonical
      continue
    }
    if (isCertList(title)) continue
    if (!t.body.trim()) continue
    if (/(^|\s)Новина(\s|$)/.test(t.tags)) continue // стрічку вже перенесли

    const gallery = await extractGallery(t.body)
    const md = twInline(stripMedia(t.body), titleToSlug)
    if (md.replace(/\s/g, "").length < 40 && !gallery.length) continue

    if (isEvent(t)) {
      const date = parseTwDate(t.created) || "2021-01-01T12:00:00.000Z"
      const slug = uniq(`${date.slice(0, 10)}-${slugify(title)}`, usedNewsSlugs)
      const data = { title, date, description: describe(md) }
      const tags = t.tags.split(/\s+/).filter((x) => /^(\d{4}|[А-ЯІЇЄҐ][а-яіїєґ]+\d{4})$/.test(x))
      if (tags.length) data.tags = tags
      if (gallery.length) data.gallery = gallery
      writeMd("news", `${slug}.md`, data, md)
      put(title, "/novyny/" + slug)
      report.newsCreated.push(slug)
    } else {
      const slug = uniq(slugify(title), usedPageSlugs)
      const data = { title, slug, blocks: [{ type: "text", text: md }] }
      if (gallery.length) data.blocks.push({ type: "gallery", title: "Фотогалерея", images: gallery })
      writeMd("pages", `${slug}.md`, data)
      put(title, "/" + slug)
      report.pagesCreated.push(slug)
    }
  }

  // ════════ 4. Переліки виданих документів -> «Облік сертифікатів» ════════
  for (const t of tiddlers.values()) {
    const title = t.title.trim()
    if (!isCertList(title) || titleMap.has(normTitle(title)) || isTrash(t)) continue
    const table = parseTwTable(t.body)
    if (!table) continue
    const slug = uniq(slugify(title), usedCertSlugs)
    const date = (parseTwDate(t.created) || "").slice(0, 10)
    const data = { title, ...(date ? { date } : {}), columns: table.columns, rows: table.rows }
    writeMd("certificates", `${slug}.md`, data)
    put(title, "/oblik-sertyfikativ/" + slug)
    report.certificatesCreated.push(slug)
  }

  // ════════ 5. Оживити пункти без посилань ════════
  /**
   * Міграція лишила рядки на кшталт `- label: січень` без адреси: матеріал, на
   * який вони вказували, не перенісся. Тепер, коли сторінки й публікації
   * відновлено, підставляємо адреси за збігом назви.
   */
  let relinked = 0
  let listsFixed = 0
  /** Розгорнути вкладені рядки в один список. */
  const walk2 = (items, acc) => {
    for (const it of items || []) {
      if (!it || typeof it !== "object") continue
      acc.push(it)
      if (Array.isArray(it.children)) walk2(it.children, acc)
    }
  }
  for (const dir of ["pages"]) {
    for (const doc of readCollection(dir)) {
      if (!Array.isArray(doc.data.blocks)) continue
      let touched = false
      const walk = (items) =>
        items.map((it) => {
          const next = { ...it }
          if (next.label && !next.url && !next.file && !next.news) {
            const href = titleToSlug(next.label)
            if (href) { next.url = href; touched = true; relinked++ }
          }
          if (Array.isArray(next.children)) next.children = walk(next.children)
          return next
        })
      let blocks = doc.data.blocks.map((b) =>
        b && b.type === "documents" && Array.isArray(b.items) ? { ...b, items: walk(b.items) } : b,
      )
      /**
       * Блок «Документи», у якому жоден рядок так і не має адреси, — це
       * насправді звичайний перелік (принципи стратегії, завдання Центру).
       * Конвертер помилково зробив із нього документи. Повертаємо текстом:
       * так редактор бачить звичайний список, а не порожні посилання.
       */
      blocks = blocks.map((b) => {
        if (!b || b.type !== "documents" || !Array.isArray(b.items) || b.items.length < 3) return b
        const flat = []
        walk2(b.items, flat)
        if (flat.some((it) => it.url || it.file || it.news)) return b
        touched = true
        const list = flat.map((it) => `- ${String(it.label || "").trim()}`).join("\n")
        return { type: "text", text: b.title ? `## ${b.title}\n\n${list}` : list }
      })
      if (touched) writeMd(dir, doc.file, { ...doc.data, blocks }, doc.content.trim())
    }
  }
  report.relinked = relinked
  report.listsFixed = listsFixed

  // Псевдоніми лишаємо лише для назв, які справді відрізняються від канонічної.
  const finalAliases = {}
  for (const [title, url] of Object.entries(aliases)) {
    if (titleMap.get(normTitle(title)) !== url || url === "/plany-roboty") finalAliases[title] = url
    else if (!titleMap.has(title)) finalAliases[title] = url
  }
  fs.writeFileSync(
    path.join(ROOT, "lib", "legacy-aliases.json"),
    JSON.stringify(
      {
        _comment:
          "Згенеровано scripts/restore-lost-content.mjs. Старі назви тіддлерів, які не мають власної сторінки (місячні плани, дублікати назв із зайвими пробілами) — щоб generate-redirects.mjs не лишив їх у 404.",
        aliases: finalAliases,
      },
      null,
      2,
    ) + "\n",
  )
  console.log(`[restore] Псевдонімів старих адрес: ${Object.keys(finalAliases).length}`)

  // ── Підсумок ──
  const totalDocs = report.documentsRestored.reduce((s, r) => s + r.added, 0)
  console.log(`\n[restore] Повернено посилань на документи: ${totalDocs} (сторінок: ${report.documentsRestored.length})`)
  console.log(`[restore] Місячних планів: ${report.plansRestored}`)
  console.log(`[restore] Нових публікацій: ${report.newsCreated.length}`)
  console.log(`[restore] Нових сторінок: ${report.pagesCreated.length}`)
  console.log(`[restore] Нових переліків сертифікатів: ${report.certificatesCreated.length}`)
  console.log(`[restore] Оживлено пунктів без посилань: ${report.relinked}`)
  console.log(`[restore] Довантажено зображень: ${report.imagesFetched}, недоступних: ${report.imagesMissing.length}`)
  fs.writeFileSync(path.join(ROOT, "restore-report.json"), JSON.stringify(report, null, 2) + "\n")
  console.log("[restore] Деталі: restore-report.json")
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
