import Link from 'next/link'
import { ArrowRight, Users, Newspaper, GraduationCap, HeartHandshake } from 'lucide-react'
import { getAllNews, getNavigation, getSiteSettings, getTeam } from '@/lib/content'
import { NewsCard } from '@/components/news-card'
import { BrandEmblem, BrandTagline } from '@/components/brand'

export default function HomePage() {
  const settings = getSiteSettings()
  const latestNews = getAllNews().slice(0, 6)
  const team = getTeam()
  const navigation = getNavigation()

  const activitySections = navigation.filter((s) => s.title !== 'Головна сторінка' && s.title !== 'Новини Центру')

  return (
    <main>
      {/* Герой */}
      <section className="bg-surface text-surface-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 flex flex-col-reverse gap-10 md:flex-row md:items-center md:gap-12">
          <div className="flex flex-col gap-6 items-start md:flex-1">
            <p className="rounded-full bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 uppercase tracking-wide">
              м. Лубни, Полтавська область
            </p>
            <h1 className="font-heading text-3xl md:text-5xl font-bold leading-tight text-balance">
              Центр професійного розвитку педагогічних працівників
            </h1>
            <BrandTagline
              words={settings.tagline}
              className="text-sm text-surface-foreground/85"
            />
            <p className="text-surface-foreground/80 leading-relaxed max-w-2xl text-pretty">
              Супроводжуємо професійне зростання педагогів Лубенської громади: консультації, атестація,
              сертифікація, супервізія та підтримка освітян в умовах сьогодення.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/novyny"
                className="inline-flex items-center gap-2 rounded-lg bg-accent text-accent-foreground font-semibold px-5 py-2.5 hover:opacity-90"
              >
                <Newspaper className="size-4" aria-hidden="true" />
                Останні новини
              </Link>
              {settings.consultation_url &&
                (settings.consultation_url.startsWith('/') ? (
                  <Link
                    href={settings.consultation_url}
                    className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-5 py-2.5 font-semibold hover:bg-surface-muted"
                  >
                    <HeartHandshake className="size-4" aria-hidden="true" />
                    Запис на консультацію
                  </Link>
                ) : (
                  <a
                    href={settings.consultation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-5 py-2.5 font-semibold hover:bg-surface-muted"
                  >
                    <HeartHandshake className="size-4" aria-hidden="true" />
                    Запис на консультацію
                  </a>
                ))}
            </div>
          </div>
          {settings.logo_emblem && (
            <BrandEmblem
              src={settings.logo_emblem}
              className="w-56 self-center shrink-0 sm:w-72 md:w-80"
            />
          )}
        </div>
      </section>

      {/* Останні новини */}
      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="latest-news">
        <div className="flex items-center justify-between mb-6">
          <h2 id="latest-news" className="font-heading text-2xl md:text-3xl font-bold">
            Останні новини
          </h2>
          <Link href="/novyny" className="text-primary font-medium text-sm inline-flex items-center gap-1 hover:underline">
            Усі новини
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {latestNews.map((item) => (
            <NewsCard key={item.slug} item={item} />
          ))}
        </div>
      </section>

      {/* Напрями діяльності */}
      <section className="bg-secondary" aria-labelledby="directions">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 id="directions" className="font-heading text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
            <GraduationCap className="size-7 text-primary" aria-hidden="true" />
            Напрями роботи
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activitySections.map((section) => (
              <div key={section.title} className="rounded-xl bg-card border border-border p-5 flex flex-col gap-3">
                <h3 className="font-heading font-bold text-primary text-pretty">{section.title}</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {section.items.slice(0, 5).map((item) => (
                    <li key={item.label}>
                      <Link href={item.url} className="text-muted-foreground hover:text-primary hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  {section.items.length > 5 && (
                    <li className="text-xs text-muted-foreground">{`та ще ${section.items.length - 5}…`}</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Команда */}
      {team.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="team">
          <h2 id="team" className="font-heading text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
            <Users className="size-7 text-primary" aria-hidden="true" />
            Наша команда
          </h2>
          <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
            {team.map((member) => (
              <div key={member.name} className="flex flex-col items-center text-center gap-3">
                {member.photo ? (
                  <img
                    src={member.photo || '/placeholder.svg'}
                    alt={member.name}
                    loading="lazy"
                    className="size-28 md:size-36 rounded-full object-cover border-4 border-secondary"
                  />
                ) : (
                  <div className="size-28 md:size-36 rounded-full bg-secondary flex items-center justify-center">
                    <Users className="size-10 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <p className="font-heading font-bold leading-snug text-pretty">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.position}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Партнери */}
      {settings.partners.length > 0 && (
        <section className="bg-secondary" aria-labelledby="partners">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 id="partners" className="font-heading text-2xl md:text-3xl font-bold mb-6">
              Ми співпрацюємо
            </h2>
            <div className="flex flex-wrap items-center gap-6">
              {settings.partners.map((p) =>
                p.url ? (
                  <a
                    key={p.name}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg bg-card border border-border px-4 py-3 hover:shadow-sm"
                  >
                    {p.image && <img src={p.image || '/placeholder.svg'} alt="" loading="lazy" className="h-10 w-auto" />}
                    <span className="text-sm font-medium">{p.name}</span>
                  </a>
                ) : (
                  <div key={p.name} className="flex items-center gap-3 rounded-lg bg-card border border-border px-4 py-3">
                    {p.image && <img src={p.image || '/placeholder.svg'} alt="" loading="lazy" className="h-10 w-auto" />}
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
