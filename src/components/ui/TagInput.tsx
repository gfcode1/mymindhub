import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn, normalizeTags } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}

export function TagInput({ value, onChange, suggestions = [], placeholder }: TagInputProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')

  const commit = () => {
    if (!draft.trim()) return
    onChange(normalizeTags([...value, ...draft.split(',')]))
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const available = suggestions.filter((tag) => !value.includes(tag)).slice(0, 8)

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              className="rounded p-0.5 hover:bg-accent/15"
              aria-label={t('tag.remove', { tag })}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={value.length === 0 ? placeholder ?? t('tag.add') : ''}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>
      {available.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {available.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(normalizeTags([...value, tag]))}
              className="rounded-lg border border-line px-2 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted"
        >
          #{tag}
        </span>
      ))}
    </div>
  )
}
