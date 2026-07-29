/**
 * Міграція сайту lubny-cprpp.ho.ua (TiddlyWiki) у Markdown-контент для Next.js + Decap CMS.
 *
 * Запуск: node scripts/migrate.mjs
 *
 * Що робить:
 * 1. Завантажує головний HTML TiddlyWiki і парсить усі тіддлери
 * 2. Для тіддлерів із тегом "Нотаток" завантажує тіло з /notes/<translit>.html
 * 3. Конвертує TiddlyWiki-розмітку в Markdown, виносить фотогалереї у frontmatter
 * 4. Завантажує всі зображення та документи в public/
 * 5. Пише content/news/*.md, content/pages/*.md, content/team/*.md, content/settings/*.yml
 * 6. Пише звіт migration-report.json
 */

import fs from "node:fs/promises"
import path from "node:path"
import * as yaml from "js-yaml"

const SITE = "https://lubny-cprpp.ho.ua"
const ROOT = path.resolve(process.cwd())
const CONTENT = path.join(ROOT, "content")
const PUBLIC = path.join(ROOT, "public")

const report = {
  newsMigrated: 0,
  pagesMigrated: 0,
  teamMigrated: 0,
  emptyBodies: [],
  failedNotes: [],
  failedAssets: [],
  skipped: [],
}

// ---------- Транслітерація ArchivePlugin (для імен файлів notes/*.html) ----------
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
function twTranslit(str) {
  return [...str].map((c) => (c in TW_TRANSLIT ? TW_TRANSLIT[c] : c)).join("")
}

// ---------- Слаги для URL ----------
const SLUG_MAP = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z",
  и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: "iu", я: "ia", ё: "e", ы: "y", э: "e", ъ: "",
}
function slugify(str) {
  return [...str.toLowerCase()]
    .map((c) => (c in SLUG_MAP ? SLUG_MAP[c] : c))
    .join("")
    .replace(/['’"«»]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "page"
}

// ---------- HTML-утиліти ----------
function unescapeHtml(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (migration)" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

async function fetchBinary(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (migration)" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// ---------- Завантаження ассетів ----------
const assetQueue = new Map() // originalPath -> localPublicPath
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|rtf|zip|rar|odt|ods)$/i
const IMG_EXT = /\.(jpe?g|png|gif|webp|svg|bmp)$/i

function registerAsset(origPath) {
  // origPath: відносний шлях типу "pict/logo.jpg" або "notes/2024/10/pam/01.jpg"
  let clean = origPath.replace(/^\.?\//, "").split("?")[0].split("#")[0]
  if (!clean || clean.startsWith("http") || clean.startsWith("mailto:")) return null
  clean = decodeURIComponent(clean)
  let local
  if (DOC_EXT.test(clean)) {
    local = "/documents/" + clean.replace(/^(pict|notes|doc|docs|files)\//, "")
  } else if (IMG_EXT.test(clean)) {
    local = "/images/" + clean
  } else {
    return null
  }
  local = local.replace(/\s+/g, "_")
  if (!assetQueue.has(clean)) assetQueue.set(clean, local)
  return assetQueue.get(clean)
}

async function downloadAssets() {
  const entries = [...assetQueue.entries()]
  console.log(`[v0] Завантаження ${entries.length} файлів...`)
  const CONCURRENCY = 16
  let done = 0
  async function worker(slice) {
    for (const [orig, local] of slice) {
      const dest = path.join(PUBLIC, local)
      try {
        await fs.mkdir(path.dirname(dest), { recursive: true })
        try {
          await fs.access(dest)
        } catch {
          const buf = await fetchBinary(`${SITE}/${orig.split("/").map(encodeURIComponent).join("/")}`)
          await fs.writeFile(dest, buf)
        }
      } catch (e) {
        report.failedAssets.push({ file: orig, error: String(e.message || e) })
      }
      done++
      if (done % 100 === 0) console.log(`[v0]   ...${done}/${entries.length}`)
    }
  }
  const chunks = Array.from({ length: CONCURRENCY }, (_, i) =>
    entries.filter((_, idx) => idx % CONCURRENCY === i),
  )
  await Promise.all(chunks.map(worker))
  console.log(`[v0] Завантажено. Помилок: ${report.failedAssets.length}`)
}

// ---------- Конвертація TiddlyWiki → Markdown ----------
function extractGalleries(text) {
  // iLoad-галереї: <a href="notes/.../01.jpg" rel="iLoad|..."><img src="notes/.../_01.jpg"/></a>
  const gallery = []
  const re = /<a\s+href="([^"]+)"\s+rel="iLoad[^"]*"\s*>\s*<img\s+src="[^"]*"\s*\/?\s*>\s*<\/a>/gi
  let out = text.replace(re, (_, href) => {
    const local = registerAsset(href)
    if (local) gallery.push({ image: local })
    return ""
  })
  // Прибрати порожні <html>-обгортки, що лишились
  out = out.replace(/<html>\s*<\/html>/gi, "")
  return { text: out, gallery }
}

function extractAttachments(text, internalLinkResolver) {
  const attachments = []
  // TiddlyWiki-посилання на документи: [[label|path.pdf]]
  let out = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m, label, target) => {
    if (DOC_EXT.test(target)) {
      const local = registerAsset(target)
      if (local) {
        attachments.push({ file: local, label: label.trim() })
        return `[${label.trim()}](${local})`
      }
    }
    return m
  })
  // HTML-посилання на документи
  out = out.replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    if (DOC_EXT.test(href) && !href.startsWith("http")) {
      const local = registerAsset(href)
      const label = inner.replace(/<[^>]+>/g, "").trim() || "Документ"
      if (local) {
        attachments.push({ file: local, label })
        return `[${label}](${local})`
      }
    }
    return m
  })
  return { text: out, attachments }
}

function convertTables(md) {
  const lines = md.split("\n")
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*\|.*\|\s*[hcf]?\s*$/.test(line) && line.trim().length > 2) {
      // Зібрати блок таблиці
      const block = []
      while (i < lines.length && /^\s*\|.*\|\s*[hcf]?\s*$/.test(lines[i])) {
        block.push(lines[i].trim())
        i++
      }
      // Конвертувати
      const rows = block
        .map((l) => l.replace(/\|\s*[hcf]\s*$/, "|"))
        .filter((l) => !/^\|\s*!?\s*\|$/.test(l))
        .map((l) =>
          l
            .slice(1, -1)
            .split("|")
            .map((c) => c.replace(/^!/, "").replace(/^[><~]$/, " ").trim()),
        )
      if (rows.length === 0) continue
      const cols = Math.max(...rows.map((r) => r.length))
      const norm = rows.map((r) => [...r, ...Array(cols - r.length).fill("")])
      out.push("| " + norm[0].join(" | ") + " |")
      out.push("|" + Array(cols).fill(" --- ").join("|") + "|")
      for (const r of norm.slice(1)) out.push("| " + r.join(" | ") + " |")
      out.push("")
    } else {
      out.push(line)
      i++
    }
  }
  return out.join("\n")
}

function twToMarkdown(raw, titleToSlug) {
  let t = raw

  // Коментарі /% ... %/
  t = t.replace(/\/%[\s\S]*?%\//g, "")
  // CSS-обгортки {{class{ ... }}}
  t = t.replace(/\{\{[\w-]+\{/g, "").replace(/\}\}\}/g, "")
  // Макроси <<...>>
  t = t.replace(/<<[\s\S]*?>>/g, "")
  // @@стилі@@ -> внутрішній текст
  t = t.replace(/@@(?:[^@]*?;)?([^@]*?)@@/g, "$1")

  // Зображення з посиланням: [img(w,h)[src][link]] або [img[підказка|src][link]]
  t = t.replace(/\[img(?:\([^)]*\))?\[([^\]]+)\]\[([^\]]+)\]\]/g, (_, srcRaw, link) => {
    const parts = srcRaw.split("|")
    const src = parts.at(-1).trim()
    const alt = parts.length > 1 ? parts[0].trim() : ""
    const local = registerAsset(src) || src
    const href = link.startsWith("http") || link.startsWith("//") ? (link.startsWith("//") ? "https:" + link : link) : titleToSlug(link) || link
    return `[![${alt}](${local})](${href})`
  })
  // Просте зображення: [img[src]] або [img[підказка|src]]
  t = t.replace(/\[img(?:\([^)]*\))?\[([^\]]+)\]\]/g, (_, srcRaw) => {
    const parts = srcRaw.split("|")
    const src = parts.at(-1).trim()
    const alt = parts.length > 1 ? parts[0].trim() : ""
    const local = registerAsset(src) || src
    return `![${alt}](${local})`
  })

  // Посилання [[label|target]]
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, label, target) => {
    label = label.trim()
    target = target.trim()
    if (/^(https?:|mailto:|\/)/.test(target)) return `[${label}](${target})`
    if (target.startsWith("//")) return `[${label}](https:${target})`
    const slug = titleToSlug(target)
    return slug ? `[${label}](${slug})` : label
  })
  // Внутрішні посилання [[target]]
  t = t.replace(/\[\[([^\]]+)\]\]/g, (_, target) => {
    target = target.trim()
    const slug = titleToSlug(target)
    return slug ? `[${target}](${slug})` : target
  })

  // Заголовки: !!! -> ###
  t = t.replace(/^(!{1,5})\s*(.+)$/gm, (_, bangs, text) => "#".repeat(bangs.length + 1) + " " + text.trim())

  // Жирний / курсив / підкреслення / верхній індекс
  t = t.replace(/''([^']+?)''/g, "**$1**")
  t = t.replace(/(^|[^:/])\/\/([^/\n][^/\n]*?)\/\//g, "$1*$2*")
  t = t.replace(/__([^_\n]+?)__/g, "<u>$1</u>")
  t = t.replace(/\^\^([^^\n]+?)\^\^/g, "<sup>$1</sup>")

  // Списки: ** -> вкладені, # -> нумеровані
  t = t.replace(/^(\*{1,4})\s*(.+)$/gm, (_, stars, text) => "  ".repeat(stars.length - 1) + "- " + text.trim())
  t = t.replace(/^(#{1,4})(?!#)\s*(.+)$/gm, (m, hashes, text) => {
    // не чіпати конвертовані заголовки (вони мають пробіл після # і починаються з ##)
    if (/^#{2,}\s/.test(m)) return m
    return "   ".repeat(hashes.length - 1) + "1. " + text.trim()
  })

  // Горизонтальна лінія
  t = t.replace(/^-{4,}\s*$/gm, "\n---\n")
  // <br> -> новий рядок
  t = t.replace(/<br\s*\/?>/gi, "\n")
  // <html> обгортки -> прибрати теги, лишити вміст як raw html
  t = t.replace(/<\/?html>/gi, "\n")

  // Таблиці
  t = convertTables(t)

  // Прибрати надлишкові порожні рядки
  t = t.replace(/\n{3,}/g, "\n\n").trim()
  return t
}

// ---------- Парсинг дати TiddlyWiki (YYYYMMDDHHMM) ----------
function parseTwDate(s) {
  if (!s || s.length < 8) return null
  const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8)
  const hh = s.length >= 12 ? s.slice(8, 10) : "12"
  const mm = s.length >= 12 ? s.slice(10, 12) : "00"
  return `${y}-${m}-${d}T${hh}:${mm}:00.000Z`
}

// ---------- Головна логіка ----------
async function main() {
  console.log("[v0] Завантажую головний HTML TiddlyWiki...")
  const src = await fetchText(SITE + "/")

  // Парсинг тіддлерів
  const tiddlers = new Map()
  const re = /<div title="([^"]*)"([^>]*)>\s*<pre>([\s\S]*?)<\/pre>\s*<\/div>/g
  let m
  while ((m = re.exec(src))) {
    const [, title, attrs, body] = m
    const tags = (attrs.match(/tags="([^"]*)"/)?.[1] || "")
    const created = attrs.match(/created="([^"]*)"/)?.[1] || ""
    const modified = attrs.match(/modified="([^"]*)"/)?.[1] || ""
    tiddlers.set(unescapeHtml(title), {
      title: unescapeHtml(title),
      tags: unescapeHtml(tags),
      created,
      modified,
      body: unescapeHtml(body),
    })
  }
  console.log(`[v0] Тіддлерів: ${tiddlers.size}`)

  // ---------- Парсинг MainMenu ----------
  const mainMenu = tiddlers.get("MainMenu")?.body || ""
  const sections = [] // { title, items: [{label, target}] }
  for (const line of mainMenu.split("\n")) {
    const sec = line.match(/^\*([^*[].*)$/)
    const item = line.match(/^\*\*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/)
    if (sec) {
      sections.push({ title: sec[1].trim(), items: [] })
    } else if (item && sections.length) {
      const label = item[1].trim()
      const target = (item[2] || item[1]).trim()
      if (/^https?:/.test(target)) {
        sections.at(-1).items.push({ label, external: target })
      } else {
        sections.at(-1).items.push({ label, target })
      }
    } else if (line.startsWith("<<")) {
      break // кінець меню, далі контакти
    }
  }
  console.log(`[v0] Розділів меню: ${sections.length}`)

  // ---------- Класифікація тіддлерів ----------
  const isNews = (t) => /(^|\s)Новина(\s|$)/.test(t.tags)
  const isTrash = (t) => /(^|\s)Кошик(\s|$)/.test(t.tags)
  const SYSTEM = new Set([
    "MainMenu", "TopMenu", "SiteTitle", "SiteSubtitle", "DefaultTiddlers", "SiteUrl",
    "StyleSheet", "ColorPalette", "MarkupPreHead", "ToolbarCommands", "EditTemplate",
    "PageTemplate", "ViewTemplate", "SideBarOptions", "SideBarTabs", "OptionsPanel",
    "AdvancedOptions", "GettingStarted", "WindowTitle", "͏",
  ])
  const isSystem = (t) =>
    SYSTEM.has(t.title) || /Plugin|Config|Template|systemConfig|Шаблон|Посилання/i.test(t.tags) ||
    /Plugin$/.test(t.title)

  // Сторінки меню
  const menuTargets = new Set()
  for (const s of sections) for (const it of s.items) if (it.target) menuTargets.add(it.target)

  // ---------- Слаги ----------
  const newsList = [...tiddlers.values()].filter((t) => isNews(t) && !isTrash(t))
  const pageList = [...tiddlers.values()].filter(
    (t) => menuTargets.has(t.title) && !isNews(t) && !isTrash(t) && !isSystem(t) && t.title !== "Новини" && t.title !== "Календар подій",
  )

  const titleSlugMap = new Map() // назва тіддлера -> url
  const usedSlugs = new Set()
  function uniqueSlug(base, prefix) {
    let s = base, n = 2
    while (usedSlugs.has(prefix + s)) s = `${base}-${n++}`
    usedSlugs.add(prefix + s)
    return s
  }
  for (const t of newsList) {
    const d = parseTwDate(t.created)?.slice(0, 10) || "2021-01-01"
    const slug = uniqueSlug(`${d}-${slugify(t.title)}`, "news:")
    t.slug = slug
    titleSlugMap.set(t.title, `/novyny/${slug}`)
  }
  for (const t of pageList) {
    const slug = uniqueSlug(slugify(t.title), "page:")
    t.slug = slug
    titleSlugMap.set(t.title, `/${slug}`)
  }
  titleSlugMap.set("Новини", "/novyny")
  const titleToSlug = (title) => titleSlugMap.get(title.trim()) || null

  // ---------- Отримання тіл нотаток ----------
  async function resolveBody(t) {
    if (t.body.trim().length > 0) return t.body
    if (!/Нотаток/.test(t.tags)) return t.body
    const fn = twTranslit(t.title) + ".html"
    const url = `${SITE}/notes/${encodeURIComponent(fn)}`
    try {
      return await fetchText(url)
    } catch (e) {
      report.failedNotes.push({ title: t.title, url, error: String(e.message || e) })
      return ""
    }
  }

  console.log(`[v0] Обробка ${newsList.length} новин та ${pageList.length} сторінок...`)

  const CONC = 12
  async function processAll(list, fn) {
    const chunks = Array.from({ length: CONC }, (_, i) => list.filter((_, idx) => idx % CONC === i))
    await Promise.all(chunks.map(async (chunk) => { for (const t of chunk) await fn(t) }))
  }

  // ---------- Новини ----------
  await fs.rm(CONTENT, { recursive: true, force: true })
  await fs.mkdir(path.join(CONTENT, "news"), { recursive: true })
  await fs.mkdir(path.join(CONTENT, "pages"), { recursive: true })
  await fs.mkdir(path.join(CONTENT, "team"), { recursive: true })
  await fs.mkdir(path.join(CONTENT, "settings"), { recursive: true })

  await processAll(newsList, async (t) => {
    const rawBody = await resolveBody(t)
    if (!rawBody.trim()) report.emptyBodies.push(t.title)
    const g = extractGalleries(rawBody)
    const a = extractAttachments(g.text, titleToSlug)
    const md = twToMarkdown(a.text, titleToSlug)
    const firstPara = md.split("\n").find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("!") && !l.startsWith("<"))
    const fm = {
      title: t.title,
      date: parseTwDate(t.created) || "2021-01-01T12:00:00.000Z",
      description: (firstPara || t.title).replace(/[*_[\]()#`]/g, "").slice(0, 160).trim(),
      tags: t.tags.split(/\s+/).map((x) => x.replace(/^\[\[|\]\]$/g, "")).filter((x) => x && !["Нотаток", "Новина"].includes(x)),
    }
    if (g.gallery.length) fm.gallery = g.gallery
    if (a.attachments.length) fm.attachments = a.attachments
    const out = `---\n${yaml.dump(fm, { lineWidth: 1000 })}---\n\n${md}\n`
    await fs.writeFile(path.join(CONTENT, "news", `${t.slug}.md`), out)
    report.newsMigrated++
  })

  // ---------- Сторінки ----------
  const sectionOf = new Map()
  for (const s of sections) for (const it of s.items) if (it.target) sectionOf.set(it.target, s.title)

  await processAll(pageList, async (t) => {
    const rawBody = await resolveBody(t)
    if (!rawBody.trim()) report.emptyBodies.push(t.title)
    const g = extractGalleries(rawBody)
    const a = extractAttachments(g.text, titleToSlug)
    const md = twToMarkdown(a.text, titleToSlug)
    const menuLabel = sections.flatMap((s) => s.items).find((it) => it.target === t.title)?.label || t.title
    const fm = {
      title: menuLabel,
      full_title: t.title !== menuLabel ? t.title : undefined,
      section: sectionOf.get(t.title) || "Інше",
      slug: t.slug,
    }
    Object.keys(fm).forEach((k) => fm[k] === undefined && delete fm[k])
    if (g.gallery.length) fm.gallery = g.gallery
    if (a.attachments.length) fm.attachments = a.attachments
    const out = `---\n${yaml.dump(fm, { lineWidth: 1000 })}---\n\n${md}\n`
    await fs.writeFile(path.join(CONTENT, "pages", `${t.slug}.md`), out)
    report.pagesMigrated++
  })

  // ---------- Команда ----------
  const team = [
    { name: "Педоряка Олена Іванівна", position: "В. о. директора", photo: "/images/pict/pedoriaka.png", order: 1 },
    { name: "Лісна Світлана Григорівна", position: "Консультант", photo: "/images/pict/lisna.png", order: 2 },
    { name: "Таранець Альона Володимирівна", position: "Консультант", photo: "/images/pict/taranets.png", order: 3 },
    { name: "Іващенко Людмила Олександрівна", position: "Психолог", photo: "/images/pict/ivaschenko.png", order: 4 },
  ]
  for (const member of team) {
    registerAsset(member.photo.replace("/images/", ""))
    const fm = { ...member }
    await fs.writeFile(
      path.join(CONTENT, "team", `${slugify(member.name)}.md`),
      `---\n${yaml.dump(fm, { lineWidth: 1000 })}---\n`,
    )
    report.teamMigrated++
  }

  // ---------- Налаштування сайту ----------
  registerAsset("pict/logo.jpg")
  registerAsset("pict/coop/minjust2.png")
  registerAsset("pict/coop/lastrada2.png")
  registerAsset("pict/coop/dsyau2.png")

  const siteSettings = {
    site_name: "Центр професійного розвитку педагогічних працівників",
    site_short_name: "ЦПРПП м. Лубни",
    site_description:
      "Комунальна установа «Центр професійного розвитку педагогічних працівників Лубенської міської ради» Лубенського району Полтавської області",
    logo: "/images/pict/logo.jpg",
    address: "37500 м. Лубни Полтавської області, вул. Григора Тютюнника 19А",
    map_url: "https://www.google.com/maps/@50.0119334,33.0010027,18z",
    phones: ["(05361)-77-416", "(05361)-77-421"],
    email: "lubny.cprpp@ukr.net",
    consultation_url: "https://forms.gle/FmyWyvGzqoBEPBwq6",
    schedule: [
      { days: "Пн–Чт", hours: "8:00 – 17:00" },
      { days: "Пт", hours: "8:00 – 16:00" },
      { days: "Обід", hours: "12:00 – 12:45" },
    ],
    partners: [
      { name: "Міністерство юстиції України", image: "/images/pict/coop/minjust2.png", url: "https://pravo.minjust.gov.ua/" },
      { name: "Ла Страда – Україна", image: "/images/pict/coop/lastrada2.png", url: "https://la-strada.org.ua/" },
      { name: "Державна служба якості освіти", image: "/images/pict/coop/dsyau2.png", url: "https://sqe.gov.ua/index.php/uk-ua/" },
    ],
  }
  await fs.writeFile(path.join(CONTENT, "settings", "site.yml"), yaml.dump(siteSettings, { lineWidth: 1000 }))

  const navigation = {
    sections: sections.map((s) => ({
      title: s.title,
      items: s.items.map((it) => ({
        label: it.label,
        url: it.external || titleToSlug(it.target) || (it.target === "Календар подій" ? "/novyny" : "/"),
      })),
    })),
  }
  // Головна сторінка розділу "Головна сторінка" веде на /
  await fs.writeFile(path.join(CONTENT, "settings", "navigation.yml"), yaml.dump(navigation, { lineWidth: 1000 }))

  // ---------- Завантаження файлів ----------
  await downloadAssets()

  // ---------- Звіт ----------
  await fs.writeFile(path.join(ROOT, "migration-report.json"), JSON.stringify(report, null, 2))
  console.log("[v0] ===== ЗВІТ МІГРАЦІЇ =====")
  console.log(`[v0] Новин: ${report.newsMigrated}`)
  console.log(`[v0] Сторінок: ${report.pagesMigrated}`)
  console.log(`[v0] Команда: ${report.teamMigrated}`)
  console.log(`[v0] Порожні тіла: ${report.emptyBodies.length}`)
  console.log(`[v0] Невдалі нотатки: ${report.failedNotes.length}`)
  console.log(`[v0] Невдалі файли: ${report.failedAssets.length}`)
  console.log("[v0] Деталі: migration-report.json")
}

main().catch((e) => {
  console.error("[v0] ПОМИЛКА:", e)
  process.exit(1)
})
