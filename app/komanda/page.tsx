import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { getSiteSettings, getTeam } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Наша команда',
  description: 'Працівники Центру професійного розвитку педагогічних працівників м. Лубни',
}

export default function TeamPage() {
  const team = getTeam()
  const { team_photo, team_caption, team_caption_heading } = getSiteSettings()

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-8">Наша команда</h1>
      {team_photo && (
        // Знімок вертикальний (3:4). Раніше він розтягувався на всю ширину сторінки
        // і обрізався по висоті — у тих, хто стоїть позаду, зникали голови. Тому
        // показуємо його цілим, у власній ширині, по центру.
        <figure className="mx-auto mb-12 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-secondary shadow-sm">
          <img
            src={team_photo}
            alt="Колектив Центру професійного розвитку педагогічних працівників"
            className="w-full h-auto"
          />
        </figure>
      )}
      {/*
        Підпис під спільним фото — текст про команду від замовника. Порожнє поле
        в налаштуваннях = підпису немає, тож редактор прибирає його очищенням.
        Абзаци розділені порожнім рядком, як у будь-якому текстовому полі.
      */}
      {team_caption && (
        <section className="mx-auto mb-12 max-w-2xl text-center">
          {team_caption_heading && (
            <h2 className="font-heading text-2xl font-bold mb-4">{team_caption_heading}</h2>
          )}
          <div className="flex flex-col gap-4 text-muted-foreground leading-relaxed">
            {team_caption
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        </section>
      )}
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {team.map((member) => (
          <div key={member.name} className="flex flex-col items-center text-center gap-4 rounded-xl border border-border bg-card p-6">
            {member.photo ? (
              <img
                src={member.photo || '/placeholder.svg'}
                alt={member.name}
                className="size-36 rounded-full object-cover border-4 border-secondary"
              />
            ) : (
              <div className="size-36 rounded-full bg-secondary flex items-center justify-center">
                <Users className="size-12 text-muted-foreground" aria-hidden="true" />
              </div>
            )}
            <div>
              <p className="font-heading font-bold text-pretty">{member.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{member.position}</p>
            </div>
            {member.bio && <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
