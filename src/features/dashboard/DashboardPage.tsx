import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  CircleCheckBig,
  DatabaseBackup,
  Download,
  Mic,
  NotebookPen,
  Plus,
  Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { PageHeader, SectionTitle } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { useBookmarks, useEvents, useNotes, useSettings, useTodos, useVoiceNotes } from '@/hooks/useData'
import { useInstallPrompt } from '@/hooks/usePwa'
import { useUIStore } from '@/hooks/useUI'
import { eventCoversDay, formatTime, isOverdue, relativeDate } from '@/lib/dates'
import { daysSince } from '@/lib/dates'
import { hostnameOf, initials, truncate } from '@/lib/utils'
import { toggleTodo } from '@/db/seed'
import { toast } from 'sonner'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 6) return 'Buonanotte'
  if (hour < 13) return 'Buongiorno'
  if (hour < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const todos = useTodos()
  const events = useEvents()
  const notes = useNotes()
  const bookmarks = useBookmarks()
  const voices = useVoiceNotes()
  const { settings } = useSettings()
  const openQuickAdd = useUIStore((state) => state.openQuickAdd)
  const { canInstall, install } = useInstallPrompt()

  const openTodos = todos.filter((todo) => !todo.done)
  const todayTodos = openTodos.filter((todo) => todo.dueDate && todo.dueDate <= format(now, 'yyyy-MM-dd'))
  const todayEvents = events
    .filter((event) => eventCoversDay(event.start, event.end, now))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const recentNotes = notes.slice(0, 3)
  const recentBookmarks = bookmarks.slice(0, 3)
  const backupAge = daysSince(settings.lastBackupAt)
  const showBackupReminder = backupAge === null || backupAge > 30

  const stats = [
    { label: 'Todo aperti', value: openTodos.length, icon: CircleCheckBig, to: '/todos' },
    { label: 'Eventi oggi', value: todayEvents.length, icon: CalendarDays, to: '/calendar' },
    { label: 'Note', value: notes.length, icon: NotebookPen, to: '/notes' },
    { label: 'Vocali', value: voices.length, icon: Mic, to: '/voice' },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={greeting(now)}
        subtitle={capitalize(format(now, "EEEE d MMMM yyyy", { locale: it }))}
        action={
          <>
            <Button variant="secondary" size="icon" onClick={() => navigate('/search')} aria-label="Cerca">
              <Sparkles size={18} />
            </Button>
            <Button onClick={openQuickAdd} size="sm" className="pr-3">
              <Plus size={16} /> Crea
            </Button>
          </>
        }
      />

      <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="group rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
          >
            <div className="flex items-center justify-between">
              <stat.icon size={17} className="text-muted transition-colors group-hover:text-accent" />
              <ArrowRight size={13} className="text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">{stat.label}</p>
          </Link>
        ))}
      </div>

      {canInstall ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Download size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Installa BinHub</p>
            <p className="text-xs text-muted">Aggiungila alla home per un accesso più rapido.</p>
          </div>
          <Button size="sm" onClick={() => void install()}>
            Installa
          </Button>
        </div>
      ) : null}

      {showBackupReminder && (notes.length > 0 || voices.length > 0) ? (
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <DatabaseBackup size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Ricordati il backup</span>
            <span className="block text-xs text-muted">
              {backupAge === null
                ? 'Non hai ancora esportato i tuoi dati.'
                : `Ultimo backup ${backupAge} giorni fa.`}
            </span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </button>
      ) : null}

      <div className="grid gap-7 lg:grid-cols-2">
        <section>
          <SectionTitle
            title="Oggi"
            action={
              <Link to="/todos" className="text-xs font-medium text-accent hover:underline">
                Tutti i todo
              </Link>
            }
          />
          <div className="space-y-2">
            {todayEvents.slice(0, 3).map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => navigate('/calendar')}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/30"
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: event.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{event.title}</span>
                  <span className="text-xs text-muted">
                    {event.allDay ? 'Tutto il giorno' : formatTime(event.start)}
                    {event.location ? ` · ${event.location}` : ''}
                  </span>
                </span>
                <CalendarDays size={15} className="text-faint" />
              </button>
            ))}

            {todayTodos.slice(0, 5).map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    void toggleTodo(todo.id)
                  }}
                  aria-label={todo.done ? 'Segna come da fare' : 'Segna come completato'}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line text-transparent transition-colors hover:border-accent hover:text-accent"
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/todos')}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium">{todo.title}</span>
                  <span
                    className={`text-xs ${isOverdue(todo.dueDate) ? 'font-medium text-danger' : 'text-muted'}`}
                  >
                    {todo.dueDate ? relativeDate(todo.dueDate) : 'Senza scadenza'}
                    {todo.priority === 'high' ? ' · Priorità alta' : ''}
                  </span>
                </button>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                    isOverdue(todo.dueDate) ? 'bg-danger/10 text-danger' : 'bg-raised text-muted'
                  }`}
                >
                  {todo.priority === 'high' ? 'Alta' : todo.priority === 'low' ? 'Bassa' : 'Normale'}
                </span>
              </div>
            ))}

            {todayEvents.length === 0 && todayTodos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-4 py-7 text-center">
                <p className="text-sm font-medium">Niente in programma</p>
                <p className="mt-1 text-xs text-muted">Goditi la giornata o aggiungi qualcosa.</p>
                <Button variant="soft" size="sm" className="mt-3" onClick={openQuickAdd}>
                  <Plus size={15} /> Aggiungi
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <SectionTitle
            title="Note recenti"
            action={
              <Link to="/notes" className="text-xs font-medium text-accent hover:underline">
                Tutte
              </Link>
            }
          />
          <div className="space-y-2">
            {recentNotes.map((note) => (
              <Link
                key={note.id}
                to={`/notes/${note.id}`}
                className="block rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors hover:border-accent/30"
              >
                <div className="flex items-center gap-2">
                  <NotebookPen size={14} className="shrink-0 text-accent" />
                  <p className="truncate text-sm font-medium">{note.title || 'Nota senza titolo'}</p>
                </div>
                {note.content ? (
                  <p className="mt-1 line-clamp-2 pl-5 text-xs leading-relaxed text-muted">
                    {truncate(note.content.replace(/[#>*_`-]/g, ''), 130)}
                  </p>
                ) : null}
              </Link>
            ))}
            {recentNotes.length === 0 ? (
              <Link
                to="/notes?new=1"
                className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted hover:text-ink"
              >
                <Plus size={16} /> Crea la prima nota
              </Link>
            ) : null}
          </div>

          <SectionTitle
            title="Link salvati"
            className="mt-6"
            action={
              <Link to="/bookmarks" className="text-xs font-medium text-accent hover:underline">
                Tutti
              </Link>
            }
          />
          <div className="space-y-2">
            {recentBookmarks.map((bookmark) => (
              <a
                key={bookmark.id}
                href={bookmark.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-accent/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-raised text-[11px] font-semibold text-muted">
                  {initials(bookmark.title || bookmark.url)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{bookmark.title}</span>
                  <span className="block truncate text-xs text-muted">{hostnameOf(bookmark.url)}</span>
                </span>
                <Bookmark size={14} className="shrink-0 text-faint" />
              </a>
            ))}
            {recentBookmarks.length === 0 ? (
              <Link
                to="/bookmarks?new=1"
                className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted hover:text-ink"
              >
                <Plus size={16} /> Salva il primo link
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => {
          navigate('/voice?record=1')
          toast('Registra una nota vocale', { description: 'Premi il microfono e inizia a parlare.' })
        }}
        className="mt-7 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent/40"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Mic size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">Registra una nota vocale</span>
          <span className="block text-xs text-muted">Idee al volo, senza scrivere.</span>
        </span>
        <ArrowRight size={16} className="text-muted" />
      </button>
    </div>
  )
}
