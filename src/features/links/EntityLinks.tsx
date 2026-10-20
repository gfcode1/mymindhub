import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  Bookmark,
  CalendarDays,
  CircleCheckBig,
  Mic,
  NotebookPen,
  Plus,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useI18n } from '@/hooks/useI18n'
import { useLinkTargets, useLinks } from '@/hooks/useLinks'
import { createEntityLink, deleteEntityLink, restoreEntityLink } from '@/db/seed'
import { entityKey, resolveEntityLinks, type ResolvedEntityLink } from '@/lib/links'
import { cn } from '@/lib/utils'
import type { LinkableType } from '@/types/models'

const TYPE_META: Record<
  LinkableType,
  { icon: LucideIcon; className: string; labelKey: 'search.typeNote' | 'search.typeTodo' | 'search.typeBookmark' | 'search.typeEvent' | 'search.typeVoice' }
> = {
  note: { icon: NotebookPen, className: 'text-teal-500', labelKey: 'search.typeNote' },
  todo: { icon: CircleCheckBig, className: 'text-emerald-500', labelKey: 'search.typeTodo' },
  bookmark: { icon: Bookmark, className: 'text-indigo-400', labelKey: 'search.typeBookmark' },
  event: { icon: CalendarDays, className: 'text-violet-400', labelKey: 'search.typeEvent' },
  voice: { icon: Mic, className: 'text-rose-400', labelKey: 'search.typeVoice' },
}

export function EntityLinks({
  type,
  id,
  className,
}: {
  type: LinkableType
  id: string
  className?: string
}) {
  const { t } = useI18n()
  const links = useLinks()
  const targets = useLinkTargets()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')

  const { outgoing, incoming } = useMemo(
    () => resolveEntityLinks(links, targets, type, id),
    [links, targets, type, id],
  )

  const linked = useMemo(
    () => new Set([...outgoing, ...incoming].map((item) => entityKey(item.target.type, item.target.id))),
    [outgoing, incoming],
  )

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return targets
      .filter((target) => {
        if (target.type === type && target.id === id) return false
        if (linked.has(entityKey(target.type, target.id))) return false
        if (!needle) return true
        return (
          target.title.toLowerCase().includes(needle) ||
          target.subtitle.toLowerCase().includes(needle)
        )
      })
      .slice(0, 60)
  }, [targets, type, id, linked, query])

  const add = async (targetType: LinkableType, targetId: string) => {
    const link = await createEntityLink({
      sourceType: type,
      sourceId: id,
      targetType,
      targetId,
    })
    if (!link) return
    toast.success(t('links.added'))
    setPickerOpen(false)
    setQuery('')
  }

  const remove = (item: ResolvedEntityLink) => {
    void deleteEntityLink(item.link.id).then(() => {
      toast(t('links.removed'), {
        action: {
          label: t('common.undo'),
          onClick: () => void restoreEntityLink(item.link.id),
        },
      })
    })
  }

  const hasLinks = outgoing.length > 0 || incoming.length > 0

  return (
    <section className={cn('rounded-2xl border border-line bg-surface p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('links.title')}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setPickerOpen((value) => !value)}>
          {pickerOpen ? <X size={14} /> : <Plus size={14} />}
          {pickerOpen ? t('common.close') : t('links.add')}
        </Button>
      </div>

      {!hasLinks ? (
        <p className="text-xs leading-relaxed text-faint">{t('links.empty')}</p>
      ) : (
        <div className="space-y-3">
          {outgoing.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                {t('links.outgoing')}
              </p>
              <div className="space-y-1.5">
                {outgoing.map((item) => (
                  <LinkRow key={item.link.id} item={item} onRemove={() => remove(item)} />
                ))}
              </div>
            </div>
          ) : null}
          {incoming.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                {t('links.backlinks')}
              </p>
              <div className="space-y-1.5">
                {incoming.map((item) => (
                  <LinkRow key={item.link.id} item={item} onRemove={() => remove(item)} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {hasLinks ? <p className="mt-3 text-[10px] leading-relaxed text-faint">{t('links.hint')}</p> : null}

      {pickerOpen ? (
        <div className="mt-3 border-t border-line pt-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('links.searchPlaceholder')}
            type="search"
            autoFocus
          />
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="px-1 py-3 text-xs text-faint">{t('links.noneFound')}</p>
            ) : (
              candidates.map((target) => {
                const meta = TYPE_META[target.type]
                return (
                  <button
                    key={entityKey(target.type, target.id)}
                    type="button"
                    onClick={() => void add(target.type, target.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-line/70 bg-canvas/40 px-2.5 py-2 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
                  >
                    <meta.icon size={15} className={cn('shrink-0', meta.className)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{target.title}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {t(meta.labelKey)}
                        {target.subtitle && target.subtitle !== t(meta.labelKey)
                          ? ` · ${target.subtitle}`
                          : ''}
                      </span>
                    </span>
                    <Plus size={14} className="shrink-0 text-faint" />
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function LinkRow({ item, onRemove }: { item: ResolvedEntityLink; onRemove: () => void }) {
  const { t } = useI18n()
  const meta = TYPE_META[item.target.type]
  return (
    <div className="group flex items-center gap-2 rounded-xl border border-line/70 px-2.5 py-2">
      <meta.icon size={15} className={cn('shrink-0', meta.className)} />
      <Link to={item.target.href} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium hover:text-accent">{item.target.title}</span>
        <span className="block truncate text-[11px] text-muted">
          {t(meta.labelKey)}
          {item.target.subtitle && item.target.subtitle !== t(meta.labelKey)
            ? ` · ${item.target.subtitle}`
            : ''}
        </span>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('links.remove')}
        className="rounded-lg p-1.5 text-faint transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <X size={13} />
      </button>
    </div>
  )
}
