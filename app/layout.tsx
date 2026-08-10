import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import { getSiteSettings, getNavigation } from '@/lib/content'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SiteAnnouncement } from '@/components/site-announcement'
import { NetlifyIdentityRedirect } from '@/components/netlify-identity-redirect'
import { SITE_URL } from '@/lib/site-url'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' })
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' })

export const metadata: Metadata = {
  // Без metadataBase Next будує Open Graph-адреси від http://localhost:3000,
  // тож обкладинки новин були непридатні для соцмереж
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ЦПРПП м. Лубни — Центр професійного розвитку педагогічних працівників',
    template: '%s — ЦПРПП м. Лубни',
  },
  description:
    'Комунальна установа «Центр професійного розвитку педагогічних працівників Лубенської міської ради» Лубенського району Полтавської області',
  /*
    Картка для Viber, Facebook і Telegram. Досі її мали лише новини з обкладинкою,
    а решта сторінок поширювалась голим посиланням. Емблема Центру — розумний
    типовий варіант: вона є завжди й одразу пояснює, чий це сайт.
  */
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: 'ЦПРПП м. Лубни',
    images: [{ url: '/brand/logo-emblem.png' }],
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#2b4a8b',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = getSiteSettings()
  const navigation = getNavigation()

  return (
    <html lang="uk" className={`light bg-background ${inter.variable} ${manrope.variable}`}>
      <body className="antialiased font-sans flex min-h-svh flex-col">
        <NetlifyIdentityRedirect />
        <SiteAnnouncement text={settings.announcement} url={settings.announcement_url} />
        <SiteHeader settings={settings} navigation={navigation} />
        <div className="flex-1">{children}</div>
        <SiteFooter settings={settings} navigation={navigation} />
      </body>
    </html>
  )
}
