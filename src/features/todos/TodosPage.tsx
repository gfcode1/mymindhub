import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  CalendarDays,
  Check,
  CircleCheckBig,
  ListChecks,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TagList } from '@/components/ui/TagInput'
import { useTodos } from '@/hooks/useData'
import { createTodo, deleteTodo, restoreTodo, toggleTodo } from '@/db/seed'
import { isOverdue, relativeDate, todayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types/models'
import { TodoEditorModal } from './TodoEditorModal'

type Filter = 'today' | 'upcoming' | 'all' | 'done'

export function TodosPage() {
  const todos = useTodos()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Todo | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const quickRef = useRef<HTMLInputElement>(null)
  const newHandled = useRef(false)

  useEffect(() => {
    if (params.get('new') === '1' && !newHandled.current) {
      newHandled.current = true
      setEditing(null)
      setEditorOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const today = todayKey()
  const counts = useMemo(
    () => ({
      today: todos.filter((todo) => !todo.done && todo.dueDate && todo.dueDate <= today).length,
      upcoming: todos.filter((todo) => !todo.done && todo.dueDate && todo.dueDate > today).length,
      all: todos.filter((todo) => !todo.done).length,
      done: todos.filter((todo) => todo.done).length,
    }),
    [todos, today],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return todos.filter((todo) => {
      if (filter === 'done' && !todo.done) return false
      if (filter !== 'done' && todo.done) return false
      if (filter === 'today' && !(todo.dueDate && todo.dueDate <= today)) return false
      if (filter === 'upcoming' && !(todo.dueDate && todo.dueDate > today)) return false
      if (!needle) return true
      return (
        todo.title.toLowerCase().includes(needle) ||
        todo.notes.toLowerCase().includes(needle) ||
        todo.tags.some((tag) => tag.includes(needle))
      )
    })
  }, [todos, filter, query, today])

  const quickAdd = () => {
    const value = quickTitle.trim()
    if (!value) {
      quickRef.current?.focus()
      return
    }
    void createTodo({ title: value }).then(() => {
      setQuickTitle('')
      toast.success('Todo aggiunto')
    })
  }

  const remove = (todo: Todo) => {
    void deleteTodo(todo.id).then(() => {
      toast('Todo eliminato', {
        action: { label: 'Annulla', onClick: () => void restoreTodo(todo.id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Todo"
        subtitle={`${counts.all} aperti · ${counts.today} per oggi`}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setEditorOpen(true)
            }}
          >
            <Plus size={16} /> Nuovo
          </Button>
        }
      />

      <div className="mb-3 flex gap-2">
        <Input
          ref={quickRef}
          value={quickTitle}
          onChange={(event) => setQuickTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              quickAdd()
            }
          }}
          placeholder="Aggiungi un todo e premi Invio…"
          className="flex-1"
          aria-label="Aggiungi un todo"
        />
        <IconButton
          label="Aggiungi"
          variant="primary"
          onClick={quickAdd}
          className="h-11 w-11 rounded-xl"
        >
          <Plus size={19} />
        </IconButton>
      </div>

      <div className="mb-3 space-y-3">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'today', label: 'Oggi', count: counts.today },
            { value: 'upcoming', label: 'Prossimi', count: counts.upcoming },
            { value: 'all', label: 'Tutti', count: counts.all },
            { value: 'done', label: 'Fatti', count: counts.done },
          ]}
        />
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca nei todo…"
            className="pl-9"
            type="search"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CircleCheckBig size={20} />}
          title={
            query
              ? 'Nessun risultato'
              : filter === 'done'
                ? 'Nessun todo completato'
                : filter === 'today'
                  ? 'Niente per oggi'
                  : 'Tutto in ordine'
          }
          description={
            query
              ? 'Prova un altro termine.'
              : filter === 'today'
                ? 'Nessuna scadenza per oggi. Goditi il momento.'
                : 'Aggiungi un’attività dalla barra qui sopra.'
          }
          action={
            filter !== 'done' && !query ? (
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  setEditing(null)
                  setEditorOpen(true)
                }}
              >
                <Plus size={15} /> Nuovo todo
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                'group flex items-start gap-3 rounded-xl border border-line bg-surface px-3 py-3 transition-colors',
                todo.done && 'opacity-65',
              )}
            >
              <button
                type="button"
                onClick={() => void toggleTodo(todo.id)}
                aria-label={todo.done ? 'Segna come da fare' : 'Segna come completato'}
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                  todo.done
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line text-transparent hover:border-accent hover:text-accent',
                )}
              >
                <Check size={13} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditing(todo)
                  setEditorOpen(true)
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={cn(
                    'block text-sm font-medium leading-snug',
                    todo.done && 'line-through',
                  )}
                >
                  {todo.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                  {todo.dueDate ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        isOverdue(todo.dueDate) && !todo.done && 'font-medium text-danger',
                      )}
                    >
                      <CalendarDays size={11} />
                      {relativeDate(todo.dueDate)}
                    </span>
                  ) : (
                    <span>Senza scadenza</span>
                  )}
                  {todo.priority !== 'normal' ? (
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-medium',
                        todo.priority === 'high'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-raised text-muted',
                      )}
                    >
                      {todo.priority === 'high' ? 'Alta' : 'Bassa'}
                    </span>
                  ) : null}
                  {todo.subtasks.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <ListChecks size={11} />
                      {todo.subtasks.filter((subtask) => subtask.done).length}/{todo.subtasks.length}
                    </span>
                  ) : null}
                  {todo.notes ? <span className="text-faint">· con note</span> : null}
                </span>
                {todo.tags.length > 0 ? <TagList tags={todo.tags} className="mt-1.5" /> : null}
              </button>

              <button
                type="button"
                onClick={() => remove(todo)}
                aria-label="Elimina todo"
                className="mt-0.5 rounded-lg p-1.5 text-faint opacity-100 transition-colors hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {filter === 'today' && counts.today > 0 ? (
        <button
          type="button"
          onClick={() => setFilter('all')}
          className="mt-4 text-xs font-medium text-accent hover:underline"
        >
          Vedi tutti i todo aperti
        </button>
      ) : null}

      <TodoEditorModal
        open={editorOpen}
        todo={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
