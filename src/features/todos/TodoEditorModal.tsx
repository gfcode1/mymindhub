import { useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { TagInput } from '@/components/ui/TagInput'
import { EntityLinks } from '@/features/links/EntityLinks'
import { useTags } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { createTodo, deleteTodo, restoreTodo, updateTodo } from '@/db/seed'
import { toDateInput, todayKey } from '@/lib/dates'
import { uid } from '@/lib/utils'
import type { Priority, Subtask, Todo } from '@/types/models'

interface TodoEditorProps {
  open: boolean
  todo: Todo | null
  initial?: { title?: string; notes?: string } | null
  onClose: () => void
}

export function TodoEditorModal({ open, todo, initial, onClose }: TodoEditorProps) {
  const tags = useTags()
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [todoTags, setTodoTags] = useState<string[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setNewSubtask('')
    if (todo) {
      setTitle(todo.title)
      setNotes(todo.notes)
      setDueDate(toDateInput(todo.dueDate))
      setPriority(todo.priority)
      setTodoTags(todo.tags)
      setSubtasks(todo.subtasks)
    } else {
      setTitle(initial?.title ?? '')
      setNotes(initial?.notes ?? '')
      setDueDate('')
      setPriority('normal')
      setTodoTags([])
      setSubtasks([])
    }
  }, [open, todo, initial])

  const addSubtask = () => {
    const value = newSubtask.trim()
    if (!value) return
    setSubtasks((current) => [...current, { id: uid(), title: value, done: false }])
    setNewSubtask('')
  }

  const save = () => {
    if (!title.trim()) {
      setError(t('todo.titleRequired'))
      return
    }
    const payload = {
      title: title.trim(),
      notes,
      dueDate: dueDate || null,
      priority,
      tags: todoTags,
      subtasks,
    }
    if (todo) {
      void updateTodo(todo.id, payload).then(() => {
        toast.success(t('todo.updated'))
        onClose()
      })
    } else {
      void createTodo(payload).then(() => {
        toast.success(t('todo.created'))
        onClose()
      })
    }
  }

  const remove = () => {
    if (!todo) return
    void deleteTodo(todo.id).then(() => {
      toast(t('todos.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreTodo(todo.id) },
      })
      onClose()
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={todo ? t('todo.edit') : t('todo.new')}
      description={todo ? undefined : t('todo.newDesc')}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {todo ? (
            <Button variant="ghost" className="text-danger" onClick={remove}>
              <Trash2 size={16} /> {t('common.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save}>{todo ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('todo.title')} htmlFor="todo-title">
          <Input
            id="todo-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
            placeholder={t('todo.titlePlaceholder')}
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('todo.due')} htmlFor="todo-due">
            <Input
              id="todo-due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
          <Field label={t('todo.priority')} htmlFor="todo-priority">
            <Select
              id="todo-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              <option value="low">{t('todo.priorityLow')}</option>
              <option value="normal">{t('todo.priorityNormal')}</option>
              <option value="high">{t('todo.priorityHigh')}</option>
            </Select>
          </Field>
        </div>

        <Field label={t('todo.notes')} htmlFor="todo-notes">
          <Textarea
            id="todo-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('todo.notesPlaceholder')}
            rows={3}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('todo.subtasks')}</span>
            <span className="text-[11px] text-faint">
              {subtasks.filter((item) => item.done).length}/{subtasks.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2 rounded-lg bg-canvas/60 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSubtasks((current) =>
                      current.map((item) =>
                        item.id === subtask.id ? { ...item, done: !item.done } : item,
                      ),
                    )
                  }
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    subtask.done ? 'border-accent bg-accent text-accent-ink' : 'border-line text-transparent'
                  }`}
                  aria-label={subtask.done ? t('todo.markUndone') : t('todo.markDone')}
                >
                  <Check size={12} />
                </button>
                <span className={`flex-1 text-sm ${subtask.done ? 'text-faint line-through' : ''}`}>
                  {subtask.title}
                </span>
                <button
                  type="button"
                  onClick={() => setSubtasks((current) => current.filter((item) => item.id !== subtask.id))}
                  className="rounded p-1 text-faint hover:text-danger"
                  aria-label={t('todo.removeSubtask')}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newSubtask}
              onChange={(event) => setNewSubtask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSubtask()
                }
              }}
              placeholder={t('todo.subtaskPlaceholder')}
              className="h-9 text-sm"
            />
            <Button variant="secondary" size="sm" onClick={addSubtask} aria-label={t('todo.addSubtask')}>
              <Plus size={15} />
            </Button>
          </div>
        </div>

        <Field label={t('todo.tags')} hint={t('todo.tagsHint')}>
          <TagInput
            value={todoTags}
            onChange={setTodoTags}
            suggestions={tags.map((tag) => tag.name)}
          />
        </Field>

        {todo ? <EntityLinks type="todo" id={todo.id} /> : null}

        {!todo ? (
          <button
            type="button"
            onClick={() => setDueDate(todayKey())}
            className="text-xs font-medium text-accent hover:underline"
          >
            {t('todo.setToday')}
          </button>
        ) : null}
      </div>
    </Modal>
  )
}
