import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"

/**
 * Конвертує кастомний синтаксис <tabs X><tab Назва>...</tab></tabs>,
 * успадкований від TiddlyWiki, у доступні <details>/<summary> блоки.
 */
function convertTabs(md: string): string {
  let out = md.replace(/<tabs[^>]*>/g, '<div class="tab-group">').replace(/<\/tabs>/g, "</div>")
  out = out.replace(/<tab ([^>]+)>/g, (_m, label) => `<details class="tab-item"><summary>${String(label).trim()}</summary>\n<div class="tab-body">\n`)
  out = out.replace(/<\/tab>/g, "\n</div></details>")
  return out
}

/**
 * Тіло сторінок і новин рендериться через dangerouslySetInnerHTML, а rehype-raw
 * пропускає у вихід довільний HTML із Markdown. Без санітизації будь-хто з
 * доступом до CMS (або до git-gateway) міг би вставити <script> на сайт.
 *
 * Схема — allowlist під теги, які реально зустрічаються в контенті:
 * <details>/<summary> (акордеони), <u>, <sup>, таблиці, зображення й посилання.
 * Класи обмежені тими, під які є стилі в app/globals.css.
 *
 * Свідомо НЕ дозволено <iframe>: у контенті його зараз немає. Якщо колись
 * знадобиться вбудовувати відео — додавати разом з allowlist доменів у src.
 */
const CONTENT_CLASSES = ["partners-grid", "tab-group", "tab-item", "tab-body"]

const schema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "details", "summary", "u", "sup", "sub"],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
    img: [...(defaultSchema.attributes?.img || []), "loading", "width", "height"],
    div: [...(defaultSchema.attributes?.div || []), ["className", ...CONTENT_CLASSES]],
    details: [["className", ...CONTENT_CLASSES], "open"],
    summary: [["className", ...CONTENT_CLASSES]],
  },
  // Лише безпечні схеми URL — відсікає javascript:, data: тощо
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel"],
    src: ["http", "https"],
  },
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify)

export async function markdownToHtml(md: string): Promise<string> {
  const prepared = convertTabs(md)
  const result = await processor.process(prepared)
  return String(result)
}
