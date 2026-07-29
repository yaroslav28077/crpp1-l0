// Чищення залишків TiddlyWiki-розмітки, які не сконвертувалися в Markdown:
// 1) color(...): / bgcolor(...): — префікси фарбування тексту
// 2) {{{ і }}} — блоки моноширинного тексту (обгортали звичайні абзаци)
// 3) description: '{{{' — зіпсовані SEO-описи; перегенеровуємо з тексту
// 4) [>img(30%,)[шлях]] — обтічні зображення: migrate.mjs розпізнавав лише
//    [img[...]] без префікса вирівнювання, тож ця розмітка лишалася в тексті
//    і показувалася читачам як є. Самі файли теж ніколи не завантажилися
//    (registerAsset для них не викликався), а старий сайт уже недоступний,
//    тому лишається тільки прибрати розмітку, зберігши текст абзацу.
// 5) " -- " — ASCII-замінник тире з TiddlyWiki; у решті контенту вже "—"
// 6) "## [](/images/...)" — зображення, вставлені як заголовок із порожнім
//    посиланням. Рендериться порожній <h2> з порожнім <a>, а саме фото не
//    показується взагалі: 76 знімків у 25 новинах були невидимі для читача.
// 7) "~" перед латинською абревіатурою (~STEM, ~YouTube) — у TiddlyWiki так
//    вимикали автолінкування CamelCase-слів; на сайті це просто зайвий символ
import fs from "node:fs"
import path from "node:path"

const CONTENT = "content"

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : []
  })
}

function firstParagraph(body) {
  const paras = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^[!\[<#|{]/.test(p) && p.length > 40)
  if (!paras.length) return ""
  let text = paras[0].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "")
  text = text.replace(/\s+/g, " ").trim().slice(0, 160)
  return text.replace(/'/g, "''")
}

let filesChanged = 0
let colorFixed = 0
let bracesFixed = 0
let descFixed = 0
let imgFixed = 0
let dashFixed = 0
let headingImgFixed = 0
let tildeFixed = 0

for (const file of walk(CONTENT)) {
  const src = fs.readFileSync(file, "utf8")
  let out = src

  // 1) префікси фарбування на початку рядка або після пробілу
  out = out.replace(/(^|\s)(?:bg)?color\([^)]{1,20}\):\s*/gm, (m, pre) => {
    colorFixed++
    return pre
  })

  // 2) рядки, що складаються лише з {{{ або }}}
  out = out.replace(/^[ \t]*(\{\{\{|\}\}\})[ \t]*\r?\n?/gm, () => {
    bracesFixed++
    return ""
  })

  // 3) зіпсований опис
  if (/^description: '?\{\{\{'?$/m.test(out)) {
    const parts = out.split("---")
    const body = parts.slice(2).join("---")
    const desc = firstParagraph(body)
    out = out.replace(/^description: '?\{\{\{'?$/m, `description: '${desc}'`)
    descFixed++
  }

  // 4) обтічні зображення [>img(30%,)[шлях]] — шлях може бути і з \, і з /
  out = out.replace(/\[[<>]?img\([^)]*\)\[[^\]]+\]\]\s*/g, () => {
    imgFixed++
    return ""
  })

  // 5) ASCII-тире між пробілами
  out = out.replace(/ -- /g, () => {
    dashFixed++
    return " — "
  })

  // 6) зображення, загорнуте в заголовок із порожнім посиланням
  out = out.replace(/^#{1,6}\s+\[\]\((\/images\/[^)]+)\)/gm, (_m, src) => {
    headingImgFixed++
    return `![](${src})`
  })

  // 7) тильда-екран перед латинськими абревіатурами
  out = out.replace(/~(?=[A-Z][A-Za-z0-9]*[A-Za-z0-9-])/g, () => {
    tildeFixed++
    return ""
  })

  if (out !== src) {
    fs.writeFileSync(file, out)
    filesChanged++
  }
}

console.log(`Файлів змінено: ${filesChanged}`)
console.log(`color(...): прибрано: ${colorFixed}`)
console.log(`{{{ / }}} прибрано: ${bracesFixed}`)
console.log(`описів перегенеровано: ${descFixed}`)
console.log(`[>img[...]] прибрано: ${imgFixed}`)
console.log(`" -- " замінено на тире: ${dashFixed}`)
console.log(`зображень із заголовка-обгортки визволено: ${headingImgFixed}`)
console.log(`тильд-екранів прибрано: ${tildeFixed}`)
