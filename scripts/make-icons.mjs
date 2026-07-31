/**
 * Іконки сайту з герба Лубен.
 *
 * Запуск: node scripts/make-icons.mjs
 *
 * Чому не просто «взяти герб і вписати в квадрат»:
 *
 * 1. Герб високий і вузький (186×247 після обрізки полів). Вписаний у квадрат
 *    цілком, він займає лише 65% ширини, тобто на вкладці 16 px від малюнка
 *    лишається смужка ~10 px — нерозбірлива. Тому для вкладки й для Google
 *    беремо тільки щит, без корони: він майже квадратний (186×192) і заповнює
 *    іконку повністю. Повний герб із короною лишається в шапці сайту та на
 *    apple-іконці, де місця вистачає.
 *
 * 2. Фон вкладкової іконки — прозорий. З білою плашкою на темній темі браузера
 *    в стрічці вкладок світився білий квадрат.
 *
 * 3. apple-icon навпаки мусить бути непрозорим: iOS кладе іконку на домашній
 *    екран, і прозорість там стає чорним тлом.
 */
import sharp from "sharp"

const SRC = "public/brand/coat-of-arms.png"
const PAD = 0.02 // 2% полів: іконка маленька, кожен піксель на вагу золота

/** Обрізає прозорі поля й повертає буфер + розміри */
async function trimmed(input) {
  const buf = await sharp(input).trim({ threshold: 1 }).png().toBuffer()
  const { width, height } = await sharp(buf).metadata()
  return { buf, width, height }
}

/**
 * Відрізає корону: шукає перший рядок, де щит стає широким.
 * Рахуємо по альфі, а не «на око», щоб при заміні файлу герба нічого не поїхало.
 */
async function shieldOnly(input) {
  const { buf, width, height } = await trimmed(input)
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  let top = 0
  for (let y = 0; y < height; y++) {
    let opaque = 0
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 16) opaque++
    if (opaque > width * 0.75) {
      top = y
      break
    }
  }

  const shield = await sharp(buf)
    .extract({ left: 0, top, width, height: height - top })
    .png()
    .toBuffer()
  const meta = await sharp(shield).metadata()
  console.log(`щит без корони: ${meta.width}×${meta.height} (корона займала ${top}px згори)`)
  return { buf: shield, width: meta.width, height: meta.height }
}

/** Вписує малюнок у квадрат із полями; background: null — прозорий фон */
async function square({ buf, width, height }, size, background) {
  const box = Math.round(size * (1 - 2 * PAD))
  const scale = Math.min(box / width, box / height)
  const resized = await sharp(buf)
    .resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
}

async function main() {
  const shield = await shieldOnly(SRC)
  const coat = await trimmed(SRC)

  // Вкладка браузера й Google: щит, прозорий фон
  await (await square(shield, 512, null)).toFile("app/icon.png")

  // iOS: повний герб на білому, бо прозорість на домашньому екрані стає чорною.
  // public/apple-icon.png віддається за тією ж адресою, що й файл із app/,
  // тому оновлюємо обидва — інакше на iPhone лишиться стара картинка.
  const white = { r: 255, g: 255, b: 255, alpha: 1 }
  for (const file of ["app/apple-icon.png", "public/apple-icon.png"]) {
    await (await square(coat, 180, white)).flatten({ background: white }).toFile(file)
  }

  for (const f of ["app/icon.png", "app/apple-icon.png", "public/apple-icon.png"]) {
    const m = await sharp(f).metadata()
    console.log(f, `${m.width}×${m.height}`, m.hasAlpha ? "alpha" : "no-alpha")
  }
}

main()
