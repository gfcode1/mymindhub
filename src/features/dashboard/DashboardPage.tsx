import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  AlarmClock,
  Archive,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  DatabaseBackup,
  Download,
  Mic,
  NotebookPen,
  Pause,
  PenTool,
  Play,
  Plus,
  Sparkles,
  ScrollText,
  Square,
  Timer,
  Wallet,
} from 'lucide-react'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import { PageHeader, SectionTitle } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmojiIcon } from '@/components/ui/EmojiIcon'
import { useBookmarks, useBudgets, useEvents, useExpenses, useHabitLogs, useHabits, useJournalEntry, useNotes, useSettings, useTimeEntries, useTodos, useVaultItems, useVoiceNotes, useWhiteboards, useAlarms } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useNow } from '@/hooks/useNow'
import { elapsedMs, finishActiveTimer, useTimerStore } from '@/hooks/useTimer'
import { useInstallPrompt } from '@/hooks/usePwa'
import { useUIStore } from '@/hooks/useUI'
import { dateKey, formatHumanDuration, formatTime, isOverdue, relativeDate, todayKey, WEEK_OPTS } from '@/lib/dates'
import { daysSince } from '@/lib/dates'
import { hostnameOf, initials, truncate } from '@/lib/utils'
import { toggleHabitLog, toggleTodo } from '@/db/seed'
import { isHabitDone, isHabitScheduled } from '@/lib/habits'
import { nextAlarm } from '@/lib/alarms'
import { filterEntriesInRange, formatClock, summarizeByCategory, totalSeconds } from '@/lib/timer'
import { budgetFor, budgetProgress, entriesForMonth, formatMoney, monthKey, summarizeExpenses } from '@/lib/expenses'
import { eventOccursOn, upcomingBirthdays } from '@/lib/recurrence'
import { toast } from 'sonner'
import type { OpenMojiName } from '@/assets/openmoji'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const todos = useTodos()
  const events = useEvents()
  const notes = useNotes()
  const bookmarks = useBookmarks()
  const voices = useVoiceNotes()
  const timeEntries = useTimeEntries()
  const expenses = useExpenses()
  const budgets = useBudgets()
  const vaultItems = useVaultItems()
  const whiteboards = useWhiteboards()
  const alarms = useAlarms()
  const habits = useHabits()
  const habitLogs = useHabitLogs()
  const { settings } = useSettings()
  const { t, locale, language } = useI18n()
  const today = todayKey()
  const journal = useJournalEntry(today)
  const openQuickAdd = useUIStore((state) => state.openQuickAdd)
  const activeTimer = useTimerStore((state) => state.active)
  const pauseTimer = useTimerStore((state) => state.pause)
  const resumeTimer = useTimerStore((state) => state.resume)
  const timerNow = useNow(1000, activeTimer !== null)
  const { canInstall, install } = useInstallPrompt()

  const greeting = () => {
    const hour = now.getHours()
    if (hour < 6) return t('dash.night')
    if (hour < 13) return t('dash.morning')
    if (hour < 18) return t('dash.afternoon')
    return t('dash.evening')
  }

  const openTodos = todos.filter((todo) => !todo.done)
  const todayTodos = openTodos.filter((todo) => todo.dueDate && todo.dueDate <= format(now, 'yyyy-MM-dd'))
  const todayEvents = events
    .map((event) => ({ event, occurrence: eventOccursOn(event, now) }))
    .filter((item) => item.occurrence !== null)
    .sort((a, b) => {
      if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1
      return a.occurrence!.start.getTime() - b.occurrence!.start.getTime()
    })
    .map((item) => item.event)
  const recentNotes = notes.slice(0, 3)
  const recentBookmarks = bookmarks.slice(0, 3)
  const todayHabits = habits.filter((habit) => !habit.archived && isHabitScheduled(habit, now))
  const birthdays = upcomingBirthdays(events, now, 30)
  const upcomingAlarm = nextAlarm(alarms, now)
  const weekEntries = filterEntriesInRange(
    timeEntries,
    startOfWeek(now, WEEK_OPTS),
    endOfWeek(now, WEEK_OPTS),
  )
  const weekTotal = totalSeconds(weekEntries)
  const topCategory = summarizeByCategory(weekEntries)[0]
  const monthExpenseSummary = summarizeExpenses(entriesForMonth(expenses, monthKey(now)))
  const overallBudget = budgetFor(budgets, '')
  const overallBudgetProgress = budgetProgress(
    monthExpenseSummary.expensesCents,
    overallBudget?.amountCents ?? 0,
  )
  const backupAge = daysSince(settings.lastBackupAt)
  const showBackupReminder = backupAge === null || backupAge > 30

  const stats: { label: string; value: number; emoji: OpenMojiName; to: string }[] = [
    { label: t('dash.stats.todos'), value: openTodos.length, emoji: 'todo', to: '/todos' },
    { label: t('dash.stats.events'), value: todayEvents.length, emoji: 'calendar', to: '/calendar' },
    { label: t('dash.stats.notes'), value: notes.length, emoji: 'note', to: '/notes' },
    { label: t('dash.stats.voices'), value: voices.length, emoji: 'microphone', to: '/voice' },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={greeting()}
        subtitle={capitalize(format(now, 'EEEE d MMMM yyyy', { locale }))}
        action={
          <>
            <Button variant="secondary" size="icon" onClick={() => navigate('/search')} aria-label={t('common.search')}>
              <Sparkles size={18} />
            </Button>
            <Button onClick={openQuickAdd} size="sm" className="pr-3">
              <Plus size={16} /> {t('common.create')}
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
              <EmojiIcon name={stat.emoji} className="h-5 w-5" />
              <ArrowRight size={13} className="text-faint opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">{stat.value}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-faint">{stat.label}</p>
          </Link>
        ))}
      </div>

      {activeTimer ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Timer size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {activeTimer.label || t('time.session')}
            </p>
            <p className="text-xs text-muted">
              {activeTimer.pausedAt !== null ? t('time.paused') : t('time.running')} ·{' '}
              {formatClock(
                activeTimer.mode === 'pomodoro'
                  ? Math.max(0, activeTimer.durationSec - Math.floor(elapsedMs(activeTimer, timerNow) / 1000))
                  : Math.floor(elapsedMs(activeTimer, timerNow) / 1000),
              )}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={activeTimer.pausedAt !== null ? resumeTimer : pauseTimer}
          >
            {activeTimer.pausedAt !== null ? <Play size={14} /> : <Pause size={14} />}
            {activeTimer.pausedAt !== null ? t('time.resume') : t('time.pause')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              void finishActiveTimer(t('time.session')).then((entry) => {
                if (entry) toast.success(t('time.saved'), { description: entry.label })
              })
            }}
          >
            <Square size={13} />
          </Button>
        </div>
      ) : weekTotal > 0 ? (
        <Link
          to="/time"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
            <Timer size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('time.weekly')}</span>
            <span className="block text-xs text-muted">
              {formatHumanDuration(weekTotal)}
              {topCategory
                ? ` · ${topCategory.category || t('time.noCategory')}`
                : ''}
            </span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      ) : null}

      {monthExpenseSummary.expensesCents > 0 || overallBudget ? (
        <Link
          to="/expenses"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
            <Wallet size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('dash.expenses')}</span>
            <span className="block truncate text-xs text-muted">
              {formatMoney(monthExpenseSummary.expensesCents, language)}
              {overallBudget && overallBudgetProgress
                ? ` · ${t('expenses.budgetUsed', {
                    used: formatMoney(monthExpenseSummary.expensesCents, language),
                    budget: formatMoney(overallBudget.amountCents, language),
                  })}`
                : ''}
            </span>
            {overallBudget && overallBudgetProgress ? (
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-raised">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, overallBudgetProgress.ratio * 100))}%`,
                    background: overallBudgetProgress.over ? 'var(--danger)' : 'var(--accent)',
                  }}
                />
              </span>
            ) : null}
          </span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      ) : null}

      {vaultItems.length > 0 ? (
        <Link
          to="/vault"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
            <Archive size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('vault.title')}</span>
            <span className="block text-xs text-muted">
              {t('vault.itemsCount', { count: vaultItems.length })}
            </span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      ) : null}

      {whiteboards.length > 0 ? (
        <Link
          to="/whiteboards"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
            <PenTool size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('dash.whiteboards')}</span>
            <span className="block text-xs text-muted">
              {t('whiteboards.strokes', { count: whiteboards.reduce((sum, board) => sum + board.strokeCount, 0) })}
            </span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      ) : null}

      {upcomingAlarm ? (
        <Link
          to="/alarms"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
            <AlarmClock size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('dash.alarms')}</span>
            <span className="block truncate text-xs text-muted">
              {format(upcomingAlarm.date, 'EEE d MMM · HH:mm', { locale })} ·{' '}
              {upcomingAlarm.alarm.label || t('alarms.labelFallback')}
            </span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </Link>
      ) : null}

      {canInstall ? (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Download size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('dash.install.title')}</p>
            <p className="text-xs text-muted">{t('dash.install.desc')}</p>
          </div>
          <Button size="sm" onClick={() => void install()}>
            {t('common.install')}
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
            <span className="block text-sm font-semibold">{t('dash.backup.title')}</span>
            <span className="block text-xs text-muted">
              {backupAge === null
                ? t('dash.backup.none')
                : t('dash.backup.last', { days: backupAge })}
            </span>
          </span>
          <ArrowRight size={16} className="text-muted" />
        </button>
      ) : null}

      {!journal ? (
        <Link
          to="/journal"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
        >
          <EmojiIcon name="journal" className="h-8 w-8" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('dash.journalTitle')}</span>
            <span className="block text-xs text-muted">{t('dash.journalPrompt')}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            <ScrollText size={13} /> {t('dash.journalAction')}
          </span>
        </Link>
      ) : null}

      {todayHabits.length > 0 ? (
        <section className="mb-7">
          <SectionTitle
            title={t('dash.habitsTitle')}
            action={
              <Link to="/habits" className="text-xs font-medium text-accent hover:underline">
                {t('dash.habitsAction')}
              </Link>
            }
          />
          <div className="flex flex-wrap gap-2">
            {todayHabits.map((habit) => {
              const done = isHabitDone(habitLogs, habit.id, dateKey(now))
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => void toggleHabitLog(habit.id, dateKey(now))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    done ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-muted'
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${done ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>
                    {done ? <Check size={12} /> : null}
                  </span>
                  {habit.name}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {birthdays.length > 0 ? (
        <section className="mb-7">
          <SectionTitle
            title={t('dash.birthdays')}
            action={
              <Link to="/calendar" className="text-xs font-medium text-accent hover:underline">
                {t('calendar.title')}
              </Link>
            }
          />
          <div className="space-y-2">
            {birthdays.slice(0, 4).map((occurrence) => (
              <div
                key={`${occurrence.event.id}-${dateKey(occurrence.start)}`}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
              >
                <EmojiIcon name="birthday" className="h-8 w-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{occurrence.event.title}</p>
                  <p className="text-xs text-muted">
                    {format(occurrence.start, 'd MMMM', { locale })}
                    {occurrence.age !== null
                      ? ` · ${t('calendar.turnsAge', { age: occurrence.age })}`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-faint">
                  {relativeDate(occurrence.start, locale, language)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-7 lg:grid-cols-2">
        <section>
          <SectionTitle
            title={t('dash.today')}
            action={
              <Link to="/todos" className="text-xs font-medium text-accent hover:underline">
                {t('dash.allTodos')}
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
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: event.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-medium">
                    {event.kind === 'birthday' ? (
                      <EmojiIcon name="birthday" className="h-4 w-4 shrink-0" />
                    ) : null}
                    <span className="truncate">{event.title}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {event.allDay ? t('dash.allDay') : formatTime(event.start)}
                    {event.location ? ` · ${event.location}` : ''}
                    {(() => {
                      const occurrence = eventOccursOn(event, now)
                      return occurrence && occurrence.age !== null
                        ? ` · ${t('calendar.turnsAge', { age: occurrence.age })}`
                        : ''
                    })()}
                  </span>
                </span>
                {event.kind === 'birthday' ? (
                  <EmojiIcon name="birthday" className="h-4 w-4 shrink-0" />
                ) : (
                  <CalendarDays size={15} className="text-faint" />
                )}
              </button>
            ))}

            {todayTodos.slice(0, 5).map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => void toggleTodo(todo.id)}
                  aria-label={todo.done ? t('todos.uncomplete') : t('todos.complete')}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line text-transparent transition-colors hover:border-accent hover:text-accent"
                >
                  <Check size={13} />
                </button>
                <button type="button" onClick={() => navigate('/todos')} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium">{todo.title}</span>
                  <span className={`text-xs ${isOverdue(todo.dueDate) ? 'font-medium text-danger' : 'text-muted'}`}>
                    {todo.dueDate ? relativeDate(todo.dueDate, locale, language) : t('todos.noDue')}
                    {todo.priority === 'high' ? ` · ${t('todos.high')}` : ''}
                  </span>
                </button>
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                    isOverdue(todo.dueDate) ? 'bg-danger/10 text-danger' : 'bg-raised text-muted'
                  }`}
                >
                  {todo.priority === 'high' ? t('todos.high') : todo.priority === 'low' ? t('todos.low') : t('todos.normal')}
                </span>
              </div>
            ))}

            {todayEvents.length === 0 && todayTodos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-4 py-7 text-center">
                <p className="text-sm font-medium">{t('dash.free')}</p>
                <p className="mt-1 text-xs text-muted">{t('dash.freeDesc')}</p>
                <Button variant="soft" size="sm" className="mt-3" onClick={openQuickAdd}>
                  <Plus size={15} /> {t('common.add')}
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <SectionTitle
            title={t('dash.recentNotes')}
            action={
              <Link to="/notes" className="text-xs font-medium text-accent hover:underline">
                {t('dash.all')}
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
                  <p className="truncate text-sm font-medium">{note.title || t('notes.untitled')}</p>
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
                <Plus size={16} /> {t('dash.createFirstNote')}
              </Link>
            ) : null}
          </div>

          <SectionTitle
            title={t('dash.savedLinks')}
            className="mt-6"
            action={
              <Link to="/bookmarks" className="text-xs font-medium text-accent hover:underline">
                {t('dash.allLinks')}
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
                <Plus size={16} /> {t('dash.saveFirstLink')}
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => {
          navigate('/voice?record=1')
          toast(t('dash.recordToast'), { description: t('dash.recordToastDesc') })
        }}
        className="mt-7 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent/40"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Mic size={20} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{t('dash.recordTitle')}</span>
          <span className="block text-xs text-muted">{t('dash.recordDesc')}</span>
        </span>
        <ArrowRight size={16} className="text-muted" />
      </button>
    </div>
  )
}
