import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  MapPin,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState } from '@/components/ui/PageHeader'
import { useEvents, useSettings, useTodos } from '@/hooks/useData'
import { saveSettings, toggleTodo } from '@/db/seed'
import {
  dateKey,
  eventCoversDay,
  formatHumanDuration,
  formatTime,
  isOverdue,
  monthMatrix,
  shiftView,
  weekDays,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarView, Todo } from '@/types/models'
import { EventEditorModal } from './EventEditorModal'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function CalendarPage() {
  const events = useEvents()
  const todos = useTodos()
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<CalendarView>(settings.calendarView)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const handledNew = useRef(false)

  useEffect(() => {
    setView(settings.calendarView)
  }, [settings.calendarView])

  useEffect(() => {
    if (params.get('new') === '1' && !handledNew.current) {
      handledNew.current = true
      setEditing(null)
      setEditorOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const selectedKey = dateKey(selected)
  const days = useMemo(() => monthMatrix(viewDate, selected), [viewDate, selected])
  const week = useMemo(() => weekDays(viewDate), [viewDate])

  const selectedEvents = useMemo(
    () =>
      events
        .filter((event) => eventCoversDay(event.start, event.end, selected))
        .sort((a, b) => {
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
          return Date.parse(a.start) - Date.parse(b.start)
        }),
    [events, selected],
  )
  const selectedTodos = todos.filter((todo) => todo.dueDate === selectedKey && !todo.deletedAt)

  const eventsForDay = (day: Date) => events.filter((event) => eventCoversDay(event.start, event.end, day))
  const todosForDay = (day: Date) => todos.filter((todo) => todo.dueDate === dateKey(day))

  const title =
    view === 'month'
      ? capitalize(format(viewDate, 'MMMM yyyy', { locale: it }))
      : view === 'week'
        ? `${format(week[0]!, 'd MMM', { locale: it })} – ${format(week[6]!, 'd MMM yyyy', { locale: it })}`
        : capitalize(format(selected, 'EEEE d MMMM yyyy', { locale: it }))

  const changeView = (next: CalendarView) => {
    setView(next)
    void saveSettings({ calendarView: next })
  }

  const move = (direction: 1 | -1) => {
    const next = shiftView(view === 'day' ? selected : viewDate, view, direction)
    setViewDate(next)
    if (view === 'day') setSelected(next)
  }

  const goToday = () => {
    const now = new Date()
    setViewDate(now)
    setSelected(now)
  }

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Calendario"
        subtitle="Eventi e scadenze in un unico posto"
        action={
          <Button size="sm" onClick={openNew}>
            <CalendarPlus size={16} /> Evento
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-1.5">
        <IconButton label="Periodo precedente" onClick={() => move(-1)} className="border border-line">
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label="Periodo successivo" onClick={() => move(1)} className="border border-line">
          <ChevronRight size={18} />
        </IconButton>
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight">{title}</p>
        <Button variant="ghost" size="sm" onClick={goToday}>
          Oggi
        </Button>
      </div>

      <SegmentedControl
        className="mb-4"
        value={view}
        onChange={changeView}
        options={[
          { value: 'month', label: 'Mese' },
          { value: 'week', label: 'Settimana' },
          { value: 'day', label: 'Giorno' },
        ]}
      />

      {view === 'month' ? (
        <div className="mb-5 rounded-2xl border border-line bg-surface p-2 sm:p-3">
          <div className="mb-1 grid grid-cols-7">
            {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((label, index) => (
              <div key={`${label}-${index}`} className="py-1 text-center text-[10px] font-semibold uppercase text-faint">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {days.map((cell) => {
              const dayEvents = eventsForDay(cell.date)
              const dayTodos = todosForDay(cell.date).filter((todo) => !todo.done)
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => {
                    setSelected(cell.date)
                    if (!cell.inMonth) setViewDate(cell.date)
                  }}
                  className={cn(
                    'relative flex h-12 flex-col items-center justify-start rounded-lg pt-1 text-[12px] transition-colors sm:h-20 sm:items-stretch sm:px-1.5 sm:pt-1',
                    cell.isSelected
                      ? 'bg-accent text-accent-ink'
                      : 'hover:bg-raised',
                    !cell.inMonth && !cell.isSelected && 'text-faint/50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium',
                      cell.isToday && !cell.isSelected && 'bg-accent-soft font-semibold text-accent',
                    )}
                  >
                    {cell.date.getDate()}
                  </span>
                  <span className="mt-1 flex gap-0.5 sm:hidden">
                    {dayEvents.length > 0 ? (
                      <span
                        className={cn('h-1 w-1 rounded-full', cell.isSelected ? 'bg-accent-ink' : 'bg-accent')}
                      />
                    ) : null}
                    {dayTodos.length > 0 ? (
                      <span
                        className={cn(
                          'h-1 w-1 rounded-full',
                          cell.isSelected ? 'bg-accent-ink/70' : 'bg-warning',
                        )}
                      />
                    ) : null}
                  </span>
                  <span className="mt-0.5 hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-left text-[9px] font-medium leading-tight',
                          cell.isSelected ? 'bg-accent-ink/15' : 'bg-raised text-muted',
                        )}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 ? (
                      <span className={cn('text-[9px]', cell.isSelected ? 'text-accent-ink/70' : 'text-faint')}>
                        +{dayEvents.length - 2}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {view === 'week' ? (
        <div className="mb-5 space-y-2">
          {week.map((day) => {
            const dayEvents = eventsForDay(day)
            const dayTodos = todosForDay(day).filter((todo) => !todo.done)
            const isSelected = dateKey(day) === selectedKey
            return (
              <div
                key={dateKey(day)}
                className={cn(
                  'rounded-xl border bg-surface p-3 transition-colors',
                  isSelected ? 'border-accent/50' : 'border-line',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelected(day)
                    setViewDate(day)
                  }}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                      isSelected ? 'bg-accent text-accent-ink' : 'bg-raised text-ink',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <span className="text-sm font-medium capitalize">{format(day, 'EEEE', { locale: it })}</span>
                  <span className="ml-auto text-[11px] text-faint">
                    {dayEvents.length + dayTodos.length === 0
                      ? 'Libero'
                      : `${dayEvents.length + dayTodos.length} elementi`}
                  </span>
                </button>
                {dayEvents.length + dayTodos.length > 0 ? (
                  <div className="mt-2 space-y-1 pl-10">
                    {dayEvents.map((event) => (
                      <div key={event.id} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: event.color }} />
                        <span className="truncate">{event.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-faint">
                          {event.allDay ? 'Tutto il giorno' : formatTime(event.start)}
                        </span>
                      </div>
                    ))}
                    {dayTodos.map((todo) => (
                      <div key={todo.id} className="flex items-center gap-2 text-xs text-muted">
                        <span className="h-2 w-2 rounded-full border border-warning" />
                        <span className="truncate">{todo.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-faint">Todo</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {view === 'day' ? (
        <div className="mb-5 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {week.map((day) => (
            <button
              key={dateKey(day)}
              type="button"
              onClick={() => {
                setSelected(day)
                setViewDate(day)
              }}
              className={cn(
                'flex min-w-12 flex-col items-center rounded-xl border px-2.5 py-1.5 text-xs transition-colors',
                dateKey(day) === selectedKey
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              <span className="text-[10px] uppercase">{format(day, 'EEE', { locale: it })}</span>
              <span className="text-base font-semibold">{format(day, 'd')}</span>
            </button>
          ))}
        </div>
      ) : null}

      {view === 'day' ? (
        <DayAgenda
          date={selected}
          events={selectedEvents}
          todos={selectedTodos}
          onNew={openNew}
          onEdit={(event) => {
            setEditing(event)
            setEditorOpen(true)
          }}
          onToggleTodo={(id) => void toggleTodo(id)}
        />
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              {view === 'week' ? 'Agenda della settimana' : capitalize(format(selected, 'EEEE d MMMM', { locale: it }))}
            </h2>
            <Button variant="ghost" size="sm" onClick={openNew}>
              <CalendarPlus size={14} /> Aggiungi
            </Button>
          </div>
          {view === 'month' ? (
            <DayAgenda
              date={selected}
              events={selectedEvents}
              todos={selectedTodos}
              onNew={openNew}
              onEdit={(event) => {
                setEditing(event)
                setEditorOpen(true)
              }}
              onToggleTodo={(id) => void toggleTodo(id)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
              Tocca un giorno per vedere l’agenda, oppure apri la vista Giorno.
            </p>
          )}
        </div>
      )}

      <EventEditorModal
        open={editorOpen}
        event={editing}
        defaultDate={selectedKey}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function DayAgenda({
  date,
  events,
  todos,
  onNew,
  onEdit,
  onToggleTodo,
}: {
  date: Date
  events: CalendarEvent[]
  todos: Todo[]
  onNew: () => void
  onEdit: (event: CalendarEvent) => void
  onToggleTodo: (id: string) => void
}) {
  const items = events.length + todos.length
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold capitalize">{format(date, 'EEEE d MMMM', { locale: it })}</p>
          <p className="text-[11px] text-faint">{items === 0 ? 'Nessun impegno' : `${items} elementi`}</p>
        </div>
        <Button variant="soft" size="sm" onClick={onNew}>
          <CalendarPlus size={14} /> Evento
        </Button>
      </div>

      {items === 0 ? (
        <div className="px-4 py-8">
          <EmptyState
            icon={<CalendarDays size={19} />}
            title="Giornata libera"
            description="Nessun evento o scadenza per questo giorno."
            className="border-0 py-2"
          />
        </div>
      ) : (
        <div className="divide-y divide-line">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-raised/40"
            >
              <span className="mt-1 h-9 w-1 shrink-0 rounded-full" style={{ background: event.color }} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  className="block w-full text-left"
                >
                  <span className="block text-sm font-medium leading-snug">{event.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {event.allDay
                        ? 'Tutto il giorno'
                        : `${formatTime(event.start)} – ${formatTime(event.end)}`}
                    </span>
                    {event.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} /> {event.location}
                      </span>
                    ) : null}
                    {!event.allDay && event.end ? (
                      <span>{formatHumanDuration((Date.parse(event.end) - Date.parse(event.start)) / 1000)}</span>
                    ) : null}
                  </span>
                  {event.description ? (
                    <span className="mt-1 line-clamp-2 block text-[12px] leading-relaxed text-muted">
                      {event.description}
                    </span>
                  ) : null}
                </button>
                {event.linkedNoteId ? (
                  <Link
                    to={`/notes/${event.linkedNoteId}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
                  >
                    <Link2 size={11} /> Nota collegata
                  </Link>
                ) : null}
              </div>
            </div>
          ))}

          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => onToggleTodo(todo.id)}
                aria-label="Completa todo"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line text-transparent hover:border-accent hover:text-accent"
              >
                <Check size={13} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{todo.title}</p>
                <p className={cn('text-[11px]', isOverdue(todo.dueDate) ? 'text-danger' : 'text-muted')}>
                  Todo in scadenza
                  {todo.tags.length > 0 ? ` · #${todo.tags[0]}` : ''}
                </p>
              </div>
              <span className="rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                Todo
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
