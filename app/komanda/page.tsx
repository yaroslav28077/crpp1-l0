import type { Metadata } from 'next'
import { Users } from 'lucide-react'
import { getTeam } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Наша команда',
  description: 'Працівники Центру професійного розвитку педагогічних працівників м. Лубни',
}

export default function TeamPage() {
  const team = getTeam()

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-8">Наша команда</h1>
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
