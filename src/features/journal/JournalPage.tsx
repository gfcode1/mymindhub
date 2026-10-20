import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { format } from 'date-fns'
import { ScrollText, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Field'
import { DictationButton } from '@/components/ui/DictationButton'
import { useJournalEntries, useJournalEntry } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { saveJournalEntry } from '@/db/seed'
import { todayKey } from '@/lib/dates'

export function JournalPage() {
  const entries = useJournalEntries()
  const today = todayKey()
  const entry = useJournalEntry(today)
  const { t, locale } = useI18n()

  const [done, setDone] = useState('')
  const [blockers, setBlockers] = useState('')
  const [reflection, setReflection] = useState('')
  const [hydrated, setHydrated] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [now] = useState(() => new Date())

  useEffect(() => {
    if (hydrated === today) return
    setDone(entry?.done ?? '')
    setBlockers(entry?.blockers ?? '')
    setReflection(entry?.reflection ?? '')
    if (entry) setHydrated(today)
  }, [entry, hydrated, today])

  const appendTo = (setter: Dispatch<SetStateAction<string>>, text: string) => {
    const clean = text.trim()
    if (!clean) return
    setter((current) => (current.trim() ? `${current.trimEnd()} ${clean}` : clean))
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveJournalEntry(today, { done, blockers, reflection })
      setHydrated(today)
      toast.success(t('journal.saved'))
    } finally {
      setSaving(false)
    }
  }

  const previous = entries.filter((item) => item.date !== today)

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('journal.title')} subtitle={t('journal.subtitle')} />

      <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              {t('journal.today')}
            </p>
            <p className="mt-0.5 text-sm text-muted capitalize">
              {format(now, 'EEEE d MMMM', { locale })}
            </p>
          </div>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            <Save size={15} /> {t('journal.save')}
          </Button>
        </div>

        <div className="space-y-4">
          <Field
            label={t('journal.done')}
            htmlFor="journal-done"
            action={<DictationButton onText={(text) => appendTo(setDone, text)} />}
          >
            <Textarea
              id="journal-done"
              value={done}
              onChange={(event) => setDone(event.target.value)}
              placeholder={t('journal.donePlaceholder')}
              rows={3}
            />
          </Field>
          <Field
            label={t('journal.blockers')}
            htmlFor="journal-blockers"
            action={<DictationButton onText={(text) => appendTo(setBlockers, text)} />}
          >
            <Textarea
              id="journal-blockers"
              value={blockers}
              onChange={(event) => setBlockers(event.target.value)}
              placeholder={t('journal.blockersPlaceholder')}
              rows={3}
            />
          </Field>
          <Field
            label={t('journal.reflection')}
            htmlFor="journal-reflection"
            action={<DictationButton onText={(text) => appendTo(setReflection, text)} />}
          >
            <Textarea
              id="journal-reflection"
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              placeholder={t('journal.reflectionPlaceholder')}
              rows={3}
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('journal.history')}
        </h2>
        {previous.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={20} />}
            title={t('journal.empty')}
            description={t('journal.emptyDesc')}
          />
        ) : (
          <div className="space-y-2">
            {previous.slice(0, 60).map((item) => (
              <article key={item.id} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  {format(new Date(`${item.date}T12:00:00`), 'EEEE d MMMM yyyy', { locale })}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {item.done || item.blockers || item.reflection || t('journal.noText')}
                </p>
                {item.done && (item.blockers || item.reflection) ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {item.blockers || item.reflection}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
