import { getAllCertificates, getAllNews, getAllPages, type PageBlock } from "@/lib/content"

/**
 * Індекс для пошуку. Збирається під час збірки й віддається одним статичним
 * файлом, а фільтрація відбувається в браузері — так сайт лишається повністю
 * статичним, без серверної частини й без зовнішнього пошукового сервісу.
 *
 * У індекс іде заголовок, короткий опис і текст: 273 новини дають файл на
 * кілька сотень кілобайт, що прийнятно для одноразового завантаження.
 */
export interface SearchDoc {
  /** t — тип: n новина, p сторінка, c перелік виданих документів */
  t: "n" | "p" | "c"
  /** u — адреса */
  u: string
  /** h — заголовок */
  h: string
  /** d — дата (лише для новин, ISO) */
  d?: string
  /** s — короткий опис для показу в результатах */
  s?: string
  /** b — слова, за якими шукаємо (у результатах не показуються) */
  b: string
}

/**
 * Пошук перевіряє кожне слово запиту окремо, тож порядок слів у тексті не
 * потрібен — досить набору унікальних. Для 273 новин це прибирає близько
 * третини ваги індексу без втрати жодного збігу.
 */
function toSearchWords(text: string): string {
  const lower = text
    .toLowerCase()
    .replace(/['’ʼ`]/g, "")
    .replace(/ё/g, "е")
  const words = new Set(lower.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))
  /*
    Облікові номери документів мають вигляд «№CPRPP2022/16». Розбивка по
    небуквенних символах ділила б їх на «cprpp2022» і «16» — і педагог, який
    вводить номер повністю, не знайшов би нічого, хоч саме за номером у
    переліки й заходять. Тому додаємо номер ще й цілим словом.
  */
  for (const num of lower.match(/[\p{L}\p{N}]+(?:\/[\p{L}\p{N}]+)+/gu) ?? []) words.add(num)
  return [...words].join(" ")
}

/** Текст із блоків сторінки — щоб пошук бачив і вміст розділів */
function blocksToText(blocks: PageBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "notice":
          return `${b.heading} ${b.text}`
        case "text":
          return b.text
        case "accordion":
          return `${b.title} ${b.text}`
        case "documents":
          return [b.title, ...b.items.map((i) => i.label)].filter(Boolean).join(" ")
        case "news_by_topic":
          // extra зберігає заходи, яких на сайті більше ніде немає —
          // без цього рядка вони випадали з пошуку
          return `${b.title || ""} ${b.extra || ""}`
        case "news_list":
        case "gallery":
          return b.title || ""
        default:
          return ""
      }
    })
    .join("\n")
}

/** Прибирає розмітку, щоб у пошук не потрапляли адреси й символи оформлення */
function stripMarkup(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[|*_`#>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildSearchIndex(): SearchDoc[] {
  const news: SearchDoc[] = getAllNews().map((n) => ({
    t: "n",
    u: `/novyny/${n.slug}`,
    h: n.title,
    d: n.date,
    s: n.description,
    b: toSearchWords(stripMarkup(`${n.title} ${n.description || ""} ${n.body}`)),
  }))

  const pages: SearchDoc[] = getAllPages().map((p) => ({
    t: "p",
    u: `/${p.slug}`,
    h: p.full_title || p.title,
    s: p.section,
    b: toSearchWords(stripMarkup(`${p.title} ${p.full_title || ""} ${blocksToText(p.blocks)} ${p.body}`)),
  }))

  /*
    Переліки виданих документів. Саме тут пошук найпотрібніший: педагог шукає
    себе за прізвищем або за номером документа, а переліків п'ять десятків —
    вручну він їх не переглядатиме. У слова йдуть усі поля запису, тож
    знаходиться і прізвище, і обліковий номер.
  */
  const certificates: SearchDoc[] = getAllCertificates().map((c) => ({
    t: "c",
    u: `/oblik-sertyfikativ/${c.slug}`,
    h: c.title,
    d: c.date,
    s: c.event ? `Захід: ${c.event}` : undefined,
    b: toSearchWords(
      stripMarkup(
        `${c.title} ${c.entries
          .map((e) => [e.name, e.record, e.issued, e.form, e.volume, e.result].filter(Boolean).join(" "))
          .join(" ")}`,
      ),
    ),
  }))

  return [...news, ...pages, ...certificates]
}
