import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Bookmark, CalendarDays, CircleCheckBig, Mic, NotebookPen, Search } from 'lucide-react'
import { Input } from '@/components/ui/Field'
import { useGlobalSearch, useTags } from '@/hooks/useData'
import { EmptyState } from '@/components/ui/PageHeader'
import type { SearchHit } from '@/hooks/useData'

const TYPE_META: Record<SearchHit['type'], { label: string; icon: typeof NotebookPen; className: string }> = {
  note: { label: 'Nota', icon: NotebookPen, className: 'bg-teal-500/10 text-teal-500' },
  todo: { label: 'Todo', icon: CircleCheckBig, className: 'bg-emerald-500/10 text-emerald-500' },
  bookmark: { label: 'Link', icon: Bookmark, className: 'bg-indigo-500/10 text-indigo-400' },
  event: { label: 'Evento', icon: CalendarDays, className: 'bg-violet-500/10 text-violet-400' },
  voice: { label: 'Vocale', icon: Mic, className: 'bg-rose-500/10 text-rose-400' },
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const results = useGlobalSearch(query)
  const tags = useTags()
  const navigate = useNavigate()

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Indietro"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-raised hover:text-ink"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca note, todo, link, eventi…"
            className="h-11 pl-10"
            type="search"
            autoFocus
          />
        </div>
      </div>

      {query.trim().length < 2 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Tag</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 24).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setQuery(tag.name)}
                className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                #{tag.name}
              </button>
            ))}
            {tags.length === 0 ? (
              <p className="text-xs text-faint">I tag compaiono quando ne aggiungi alle note o ai todo.</p>
            ) : null}
          </div>
          <div className="mt-8">
            <EmptyState
              icon={<Search size={20} />}
              title="Cerca in tutto"
              description="Scrivi almeno due caratteri. La ricerca è locale e funziona offline."
            />
          </div>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title="Nessun risultato"
          description={`Nessun contenuto corrisponde a “${query.trim()}”.`}
        />
      ) : (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {results.length} {results.length === 1 ? 'risultato' : 'risultati'}
          </p>
          <div className="space-y-1.5">
            {results.map((hit) => {
              const meta = TYPE_META[hit.type]
              return (
                <Link
                  key={`${hit.type}-${hit.id}`}
                  to={hit.href}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors hover:border-accent/40"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.className}`}>
                    <meta.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{hit.title}</span>
                      <span className="shrink-0 rounded bg-raised px-1.5 py-0.5 text-[10px] text-muted">
                        {meta.label}
                      </span>
                    </span>
                    {hit.subtitle ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">
                        {hit.subtitle}
                      </span>
                    ) : null}
                    {hit.tags.length > 0 ? (
                      <span className="mt-1 block text-[10px] text-faint">
                        {hit.tags.map((tag) => `#${tag}`).join(' ')}
                      </span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
