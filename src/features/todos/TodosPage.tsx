import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  CalendarDays,
  Check,
  CircleCheckBig,
  ListChecks,
  Plus,
  Search,
  Timer,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TagList } from '@/components/ui/TagInput'
import { useTodos } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useUIStore } from '@/hooks/useUI'
import { createTodo, deleteTodo, restoreTodo, toggleTodo } from '@/db/seed'
import { isOverdue, relativeDate, todayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Todo } from '@/types/models'
import { TodoEditorModal } from './TodoEditorModal'

type Filter = 'today' | 'upcoming' | 'all' | 'done'

export function TodosPage() {
  const todos = useTodos()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { t, locale, language } = useI18n()
  const consumeDraft = useUIStore((state) => state.consumeDraft)
  const draft = useUIStore((state) => state.draft)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Todo | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [initial, setInitial] = useState<{ title?: string; notes?: string } | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const quickRef = useRef<HTMLInputElement>(null)
  const newHandled = useRef(false)

  useEffect(() => {
    if (params.get('new') === '1' && !newHandled.current) {
      newHandled.current = true
      setInitial(null)
      setEditing(null)
      setEditorOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    if (!draft) return
    setInitial({ title: draft.title, notes: draft.text })
    setEditing(null)
    setEditorOpen(true)
    consumeDraft()
  }, [draft, consumeDraft])

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
      toast.success(t('todos.added'))
    })
  }

  const remove = (todo: Todo) => {
    void deleteTodo(todo.id).then(() => {
      toast(t('todos.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreTodo(todo.id) },
      })
    })
  }

  const openNew = () => {
    setInitial(null)
    setEditing(null)
    setEditorOpen(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('todos.title')}
        subtitle={t('todos.openCount', { count: counts.all, today: counts.today })}
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> {t('todos.new')}
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
          placeholder={t('todos.quickPlaceholder')}
          className="flex-1"
          aria-label={t('todos.quickAria')}
        />
        <IconButton
          label={t('common.add')}
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
            { value: 'today', label: t('todos.filterToday'), count: counts.today },
            { value: 'upcoming', label: t('todos.filterUpcoming'), count: counts.upcoming },
            { value: 'all', label: t('todos.filterAll'), count: counts.all },
            { value: 'done', label: t('todos.filterDone'), count: counts.done },
          ]}
        />
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('todos.searchPlaceholder')}
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
              ? t('todos.noResults')
              : filter === 'done'
                ? t('todos.noDone')
                : filter === 'today'
                  ? t('todos.nothingToday')
                  : t('todos.allDone')
          }
          description={
            query
              ? t('todos.noResultsDesc')
              : filter === 'today'
                ? t('todos.nothingTodayDesc')
                : t('todos.allDoneDesc')
          }
          action={
            filter !== 'done' && !query ? (
              <Button variant="soft" size="sm" onClick={openNew}>
                <Plus size={15} /> {t('todos.newTodo')}
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
                aria-label={todo.done ? t('todos.uncomplete') : t('todos.complete')}
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
                  setInitial(null)
                  setEditing(todo)
                  setEditorOpen(true)
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className={cn('block text-sm font-medium leading-snug', todo.done && 'line-through')}>
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
                      {relativeDate(todo.dueDate, locale, language)}
                    </span>
                  ) : (
                    <span>{t('todos.noDue')}</span>
                  )}
                  {todo.priority !== 'normal' ? (
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-medium',
                        todo.priority === 'high' ? 'bg-danger/10 text-danger' : 'bg-raised text-muted',
                      )}
                    >
                      {todo.priority === 'high' ? t('todos.high') : t('todos.low')}
                    </span>
                  ) : null}
                  {todo.subtasks.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <ListChecks size={11} />
                      {todo.subtasks.filter((subtask) => subtask.done).length}/{todo.subtasks.length}
                    </span>
                  ) : null}
                  {todo.notes ? <span className="text-faint">· {t('todos.withNotes')}</span> : null}
                </span>
                {todo.tags.length > 0 ? <TagList tags={todo.tags} className="mt-1.5" /> : null}
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(`/timer?todo=${todo.id}&label=${encodeURIComponent(todo.title)}`)
                }
                aria-label={t('time.startForTodo')}
                title={t('time.startForTodo')}
                className="mt-0.5 rounded-lg p-1.5 text-faint transition-colors hover:bg-accent-soft hover:text-accent sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Timer size={15} />
              </button>

              <button
                type="button"
                onClick={() => remove(todo)}
                aria-label={t('todos.delete')}
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
          {t('todos.seeAll')}
        </button>
      ) : null}

      <TodoEditorModal
        open={editorOpen}
        todo={editing}
        initial={initial}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
          setInitial(null)
        }}
      />
    </div>
  )
}
