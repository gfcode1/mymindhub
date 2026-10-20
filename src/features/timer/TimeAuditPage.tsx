import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { BarChart3, Link2, Timer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, SectionTitle, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useTimeEntries } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { deleteTimeEntry, restoreTimeEntry } from '@/db/seed'
import { formatDate, formatHumanDuration, WEEK_OPTS } from '@/lib/dates'
import { filterEntriesInRange, formatClock, summarizeByCategory, totalSeconds } from '@/lib/timer'
import { tagColor } from '@/lib/utils'

type Range = 'week' | 'month'

export function TimeAuditPage() {
  const entries = useTimeEntries()
  const { t, tCount, locale } = useI18n()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('week')
  const [now] = useState(() => new Date())

  const start = range === 'week' ? startOfWeek(now, WEEK_OPTS) : startOfMonth(now)
  const end = range === 'week' ? endOfWeek(now, WEEK_OPTS) : endOfMonth(now)
  const filtered = useMemo(
    () => filterEntriesInRange(entries, start, end),
    [entries, start, end],
  )
  const total = totalSeconds(filtered)
  const summary = summarizeByCategory(filtered)

  const remove = (id: string) => {
    void deleteTimeEntry(id).then(() => {
      toast(t('time.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreTimeEntry(id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('time.auditTitle')}
        subtitle={t('time.auditSubtitle')}
        action={
          <Button size="sm" onClick={() => navigate('/timer')}>
            <Timer size={15} /> {t('time.title')}
          </Button>
        }
      />

      <SegmentedControl
        className="mb-4"
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: t('time.week') },
          { value: 'month', label: t('time.month') },
        ]}
      />

      <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              {t('time.total')}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {total > 0 ? formatHumanDuration(total) : '0 min'}
            </p>
          </div>
          <p className="text-xs text-muted">{tCount('time.sessions', filtered.length)}</p>
        </div>
      </section>

      <section className="mb-7">
        <SectionTitle title={t('time.byCategory')} />
        {summary.length === 0 ? (
          <EmptyState
            icon={<BarChart3 size={20} />}
            title={t('time.noEntries')}
            description={t('time.noEntriesDesc')}
          />
        ) : (
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            {summary.map((item) => {
              const label = item.category || t('time.noCategory')
              const percentage = total > 0 ? (item.seconds / total) * 100 : 0
              return (
                <div key={item.category || 'none'}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: tagColor(label) }}
                      />
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatHumanDuration(item.seconds)} · {Math.round(percentage)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{ width: `${Math.max(2, percentage)}%`, background: tagColor(label) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title={t('time.sessions')} />
        {filtered.length === 0 ? (
          <EmptyState title={t('time.noEntries')} description={t('time.noEntriesDesc')} />
        ) : (
          <div className="space-y-1.5">
            {filtered.slice(0, 120).map((entry) => {
              const category = entry.category || t('time.noCategory')
              return (
                <div
                  key={entry.id}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tagColor(category) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.label}</p>
                    <p className="truncate text-[11px] text-muted">
                      {category} · {formatDate(entry.startedAt, 'd MMM, HH:mm', locale)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatClock(entry.durationSec)}
                  </span>
                  {entry.noteId ? (
                    <Link
                      to={`/notes/${entry.noteId}`}
                      className="text-faint hover:text-accent"
                      aria-label={t('time.linkedNote')}
                    >
                      <Link2 size={14} />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(entry.id)}
                    aria-label={t('time.delete')}
                    className="rounded-lg p-1.5 text-faint opacity-100 transition-colors hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
