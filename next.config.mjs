import legacy from './lib/legacy-redirects.json' with { type: 'json' }

/**
 * Заголовки нотаток старого сайту містять символи, які path-to-regexp
 * (його використовує Next для source) тлумачить як синтаксис шаблону:
 * дужки з транслітерації «» -> (( )), а також ^ $ : . тощо.
 * Без екранування правило або не збіглося б, або зламало б збірку.
 */
function escapeSource(p) {
  return p.replace(/[\\^$.*+?()[\]{}|:]/g, '\\$&')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  /*
    Заголовки безпеки. Спершу вони стояли лише в netlify.toml — і виявилось,
    що там вони працюють тільки для файлів, які CDN віддає напряму (/admin/,
    /images/*), а маршрути сайту йдуть через адаптер Next і заголовків не
    отримували. Перевірено на проді: /admin/ мав x-frame-options, головна — ні.
    Тому те саме оголошуємо тут: ці заголовки Next додає до власних відповідей.

    CSP свідомо не додаємо: Netlify Identity й inline-стилі Next потребують
    окремої перевірки, щоб не зламати адмінку.
  */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      // Next прибирає кінцевий слеш, тому /admin/ -> 308 -> /admin, а /admin
      // перехоплював катч-ол app/[slug] і віддавав 404 — адмінка була
      // недоступна. Віддаємо статичний index.html CMS напряму.
      { source: '/admin', destination: '/admin/index.html' },
    ]
  },
  async redirects() {
    return [
      // Архів новин переїхав із query-параметрів на статичні шляхи.
      // Найспецифічніше правило має йти першим.
      {
        source: '/novyny',
        has: [
          { type: 'query', key: 'rik', value: '(?<rik>\\d{4})' },
          { type: 'query', key: 'storinka', value: '(?<storinka>\\d+)' },
        ],
        destination: '/novyny/rik/:rik/storinka/:storinka',
        permanent: true,
      },
      {
        source: '/novyny',
        has: [{ type: 'query', key: 'rik', value: '(?<rik>\\d{4})' }],
        destination: '/novyny/rik/:rik',
        permanent: true,
      },
      {
        source: '/novyny',
        has: [{ type: 'query', key: 'storinka', value: '(?<storinka>\\d+)' }],
        destination: '/novyny/storinka/:storinka',
        permanent: true,
      },
      // Голі префікси архіву без значення — на початок стрічки
      { source: '/novyny/rik', destination: '/novyny', permanent: false },
      { source: '/novyny/storinka', destination: '/novyny', permanent: false },

      // Точкові переходи зі старих адрес /notes/<translit>.html.
      // Генерується scripts/generate-redirects.mjs із заголовків контенту.
      ...legacy.rules.map((r) => ({
        source: escapeSource(r.from),
        destination: r.to,
        permanent: true,
      })),
      // Зображення старого сайту лежали в /pict/ і /notes/, тепер під /images/.
      // Ідуть ПІСЛЯ точкових правил, щоб не перехопити /notes/<назва>.html.
      //
      // Тут навмисно НЕ використовується regex у `source`: Next його розуміє,
      // але адаптер Netlify конвертує кожне правило у власний формат редиректів,
      // де регулярних виразів немає, — і збірка падає. Натомість усі 482 старі
      // адреси сторінок мають точкові правила вище (їх генерує
      // scripts/generate-redirects.mjs), тож сюди доходять лише файли.
      { source: '/pict/:path*', destination: '/images/pict/:path*', permanent: true },
      { source: '/notes/:path*', destination: '/images/notes/:path*', permanent: true },
    ]
  },
}

export default nextConfig
