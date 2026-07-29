import sharp from 'sharp'

const SRC = 'public/brand/logo-full.png'
const OUT = 'public/brand'

// Колір паперу, заміряний у куті фотографії
const BG = [248, 248, 246]

/**
 * Прибирає світлий фон і повертає sharp-об'єкт із прозорістю.
 * Альфа рахується від відстані до кольору паперу, а колір
 * "розпремножується" назад від фону — інакше краї штрихів
 * лишаються блідими й логотип виглядає вицвілим.
 */
async function unbake(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const out = Buffer.alloc(width * height * 4)

  const LO = 14 // нижче — вважаємо чистим папером
  const HI = 62 // вище — вважаємо повністю щільним чорнилом

  for (let p = 0; p < width * height; p++) {
    const i = p * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const d = Math.max(Math.abs(r - BG[0]), Math.abs(g - BG[1]), Math.abs(b - BG[2]))
    let a = (d - LO) / (HI - LO)
    a = a < 0 ? 0 : a > 1 ? 1 : a

    const o = p * 4
    if (a === 0) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0
      continue
    }

    // Знімаємо домішку паперу з напівпрозорих пікселів
    const un = (v, bg) => {
      const val = bg + (v - bg) / a
      return val < 0 ? 0 : val > 255 ? 255 : Math.round(val)
    }
    out[o] = un(r, BG[0])
    out[o + 1] = un(g, BG[1])
    out[o + 2] = un(b, BG[2])
    out[o + 3] = Math.round(a * 255)
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png()
}

/**
 * Зона пошуку логотипа на фотографії. Вужча за кадр навмисно: праворуч
 * лишається край аркуша, а в правому нижньому куті — водяний знак, і те
 * й те не має потрапити в межі малюнка.
 */
const SCAN = { x0: 130, x1: 1090, y0: 30, y1: 640 }

/**
 * Знаходить точні межі малюнка. Раніше вони були прописані числами
 * "на око" — і кроп виходив упритул до чорнила: стрічка торкалася лівого
 * й правого краю, а гасло — низу. На білій плашці це читалося як
 * обрізаний і перекошений логотип.
 */
async function inkBounds(input, threshold = 22) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = Math.max(0, SCAN.y0); y < Math.min(height, SCAN.y1); y++) {
    for (let x = Math.max(0, SCAN.x0); x < Math.min(width, SCAN.x1); x++) {
      const i = (y * width + x) * channels
      const d = Math.max(
        Math.abs(data[i] - BG[0]),
        Math.abs(data[i + 1] - BG[1]),
        Math.abs(data[i + 2] - BG[2]),
      )
      if (d <= threshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** Додає рівні прозорі поля навколо малюнка — «повітря» замість впритул. */
async function withMargin(input, ratio) {
  const buf = await sharp(input).toBuffer()
  const { width, height } = await sharp(buf).metadata()
  const pad = Math.round(Math.max(width, height) * ratio)

  return sharp({
    create: {
      width: width + pad * 2,
      height: height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: buf, left: pad, top: pad }])
    .png()
}

// Центральний символ: постаті, пагін і стрілка
const MARK = { left: 540, top: 112, width: 300, height: 236 }

async function main() {
  const full = await inkBounds(SRC)
  console.log('межі малюнка', full)

  const cropped = await sharp(SRC).extract(full).png().toBuffer()
  const emblem = await unbake(cropped)
  // 5% полів: досить, щоб стрічка не торкалася країв плашки
  await (await withMargin(await emblem.toBuffer(), 0.05)).toFile(`${OUT}/logo-emblem.png`)

  const markRaw = await sharp(SRC).extract(MARK).png().toBuffer()
  const markUnbaked = await unbake(markRaw)
  // trim по прозорості: MARK задано з запасом, тож зрізаємо порожні краї,
  // щоб символ сів по центру, а не з випадковим зсувом
  const markBuf = await sharp(await markUnbaked.toBuffer())
    .trim({ threshold: 1 })
    .png()
    .toBuffer()
  await sharp(markBuf).toFile(`${OUT}/logo-mark.png`)
  const meta = await sharp(markBuf).metadata()
  const side = Math.max(meta.width, meta.height)
  // Щедрі поля: символ ширший за висоту, тож із малим відступом він
  // торкався б лівого й правого краю іконки
  const pad = Math.round(side * 0.2)
  const canvas = side + pad * 2

  const square = await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: markBuf, gravity: 'center' }])
    .png()
    .toBuffer()

  await sharp(square).resize(512, 512).png().toFile(`${OUT}/logo-mark-square.png`)

  // Іконки вкладок — на світлому тлі, як і плашки на сайті.
  // На синьому темно-зелена постать і стрічка тонули у фоні, і на 32 px
  // іконка перетворювалася на пляму.
  for (const [size, file] of [
    [512, 'app/icon.png'],
    [180, 'app/apple-icon.png'],
  ]) {
    await sharp(square)
      .resize(size, size)
      .flatten({ background: { r: 253, g: 253, b: 252 } })
      .png()
      .toFile(file)
  }

  for (const f of ['logo-emblem.png', 'logo-mark.png', 'logo-mark-square.png']) {
    const m = await sharp(`${OUT}/${f}`).metadata()
    console.log(f, `${m.width}x${m.height}`, m.hasAlpha ? 'alpha' : 'no-alpha')
  }
}

main()
