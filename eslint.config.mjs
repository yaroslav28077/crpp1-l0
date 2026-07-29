import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/admin/vendor/**', // сторонні збірки CMS, лежать як є
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // На сайті свідомо використовується звичайний <img>, а не next/image:
      // images.unoptimized = true, тож оптимізація однаково не працює,
      // а більшість розмітки приходить із Markdown, куди компонент не вставиш.
      '@next/next/no-img-element': 'off',
    },
  },
]

export default config
