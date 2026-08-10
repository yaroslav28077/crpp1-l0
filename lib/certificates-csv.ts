import type { CertificateItem } from "./content"

/**
 * Назви стовпців переліку. Живуть тут, а не на сторінці, бо той самий набір
 * потрібен і таблиці, і файлу для Excel — інакше два списки роз'їхалися б
 * після першої ж правки формулювання.
 */
export const CERTIFICATE_COLUMNS = [
  "№ з/п",
  "Прізвище, ім\u02bcя, по батькові слухача",
  "Форма проходження курсу підвищення кваліфікації",
  "Обсяг, кількість модулів (годин ЄКТС), тривалість",
  "Обліковий запис документа",
  "Дата видачі документа",
  "Результат проходження курсу підвищення кваліфікації",
]

/**
 * Клітинка для CSV. Excel розриває значення на крапці з комою й ламає рядок на
 * переносі, тому все, що містить розділювач, лапки чи перенос, беремо в лапки,
 * а внутрішні лапки подвоюємо.
 */
function cell(value?: string): string {
  const text = (value ?? "").trim()
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Перелік у вигляді CSV для Excel.
 *
 * Два рішення заради українського Excel: розділювач — крапка з комою (він читає
 * кому як десятковий знак і складає весь рядок в одну клітинку), а на початку
 * файлу стоїть BOM, без якого кирилиця відкривається абракадаброю.
 */
export function buildCertificateCsv(item: CertificateItem): string {
  const rows = [
    CERTIFICATE_COLUMNS.map(cell),
    ...item.entries.map((entry, i) => [
      cell(String(i + 1)),
      cell(entry.name),
      cell(entry.form),
      cell(entry.volume),
      cell(entry.record),
      cell(entry.issued),
      cell(entry.result),
    ]),
  ]
  return `\uFEFF${rows.map((row) => row.join(";")).join("\r\n")}\r\n`
}
