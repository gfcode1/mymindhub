import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, SectionTitle, EmptyState } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useBudgets, useExpenses } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { createExpense, deleteExpense, restoreExpense, setBudget } from '@/db/seed'
import { formatDate, todayKey } from '@/lib/dates'
import {
  budgetFor,
  budgetProgress,
  entriesForMonth,
  formatMoney,
  monthKey,
  parseAmountToCents,
  shiftMonthKey,
  summarizeExpenses,
} from '@/lib/expenses'
import { tagColor } from '@/lib/utils'
import type { Budget, Expense, ExpenseType } from '@/types/models'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function ExpensesPage() {
  const expenses = useExpenses()
  const budgets = useBudgets()
  const { t, locale, language } = useI18n()
  const [month, setMonth] = useState(() => monthKey())
  const [type, setType] = useState<ExpenseType>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(() => todayKey())
  const [budgetOpen, setBudgetOpen] = useState(false)

  const monthEntries = useMemo(() => entriesForMonth(expenses, month), [expenses, month])
  const summary = useMemo(() => summarizeExpenses(monthEntries), [monthEntries])
  const overallBudget = budgetFor(budgets, '')
  const overallProgress = budgetProgress(summary.expensesCents, overallBudget?.amountCents ?? 0)
  const monthDate = new Date(`${month}-01T12:00:00`)
  const monthLabel = capitalize(format(monthDate, 'MMMM yyyy', { locale }))
  const maxCategory = summary.byCategory[0]?.cents ?? 1

  const categories = useMemo(
    () =>
      [...new Set([...expenses.map((item) => item.category), ...budgets.map((item) => item.category)])]
        .map((value) => value.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [expenses, budgets],
  )

  const add = async () => {
    const cents = parseAmountToCents(amount)
    if (!cents) {
      toast.error(t('expenses.invalidAmount'))
      return
    }
    await createExpense({
      amountCents: cents,
      description:
        description.trim() ||
        (type === 'expense' ? t('expenses.expense') : t('expenses.income')),
      category,
      date,
      type,
    })
    toast.success(t('expenses.added'))
    setAmount('')
    setDescription('')
    setMonth(monthKey(date))
  }

  const remove = (entry: Expense) => {
    void deleteExpense(entry.id).then(() => {
      toast(t('expenses.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreExpense(entry.id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <datalist id="expense-categories">
        {categories.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      <PageHeader
        title={t('expenses.title')}
        subtitle={t('expenses.subtitle')}
        action={
          <Button variant="secondary" size="sm" onClick={() => setBudgetOpen(true)}>
            <Target size={15} /> {t('expenses.budget')}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-1.5">
        <IconButton label={t('calendar.prev')} onClick={() => setMonth(shiftMonthKey(month, -1))} className="border border-line">
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label={t('calendar.next')} onClick={() => setMonth(shiftMonthKey(month, 1))} className="border border-line">
          <ChevronRight size={18} />
        </IconButton>
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight">{monthLabel}</p>
        <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey())}>
          {t('expenses.thisMonth')}
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <SummaryCard
          label={t('expenses.totalExpenses')}
          value={formatMoney(summary.expensesCents, language)}
          className="text-danger"
        />
        <SummaryCard
          label={t('expenses.totalIncome')}
          value={formatMoney(summary.incomeCents, language)}
          className="text-success"
        />
        <SummaryCard
          label={t('expenses.balance')}
          value={formatMoney(summary.balanceCents, language)}
          className={summary.balanceCents < 0 ? 'text-danger' : 'text-ink'}
        />
      </div>

      <section className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              {t('expenses.overallBudget')}
            </p>
            {overallBudget && overallProgress ? (
              <p className="mt-1 text-sm text-muted">
                {t('expenses.budgetUsed', {
                  used: formatMoney(summary.expensesCents, language),
                  budget: formatMoney(overallBudget.amountCents, language),
                })}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">{t('expenses.noBudget')}</p>
            )}
          </div>
          <Wallet size={18} className="text-accent" />
        </div>
        {overallBudget && overallProgress ? (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full transition-[width] ${overallProgress.over ? 'bg-danger' : 'bg-accent'}`}
                style={{ width: `${Math.max(2, Math.min(100, overallProgress.ratio * 100))}%` }}
              />
            </div>
            <p className={`mt-1.5 text-[11px] ${overallProgress.over ? 'text-danger' : 'text-faint'}`}>
              {overallProgress.over
                ? t('expenses.overBudget', {
                    amount: formatMoney(Math.abs(overallProgress.remainingCents), language),
                  })
                : t('expenses.budgetRemaining', {
                    amount: formatMoney(overallProgress.remainingCents, language),
                  })}
            </p>
          </>
        ) : null}
      </section>

      <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            {t('expenses.add')}
          </h2>
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              { value: 'expense', label: t('expenses.expense') },
              { value: 'income', label: t('expenses.income') },
            ]}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[7rem_1fr]">
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={t('expenses.amountPlaceholder')}
            inputMode="decimal"
            aria-label={t('expenses.amount')}
          />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('expenses.descriptionPlaceholder')}
            aria-label={t('expenses.description')}
          />
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t('expenses.categoryPlaceholder')}
            list="expense-categories"
            aria-label={t('expenses.category')}
          />
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label={t('expenses.date')}
          />
          <Button onClick={() => void add()}>
            <Plus size={16} /> {t('expenses.add')}
          </Button>
        </div>
      </section>

      <section className="mb-7">
        <SectionTitle title={t('expenses.byCategory')} />
        {summary.byCategory.length === 0 ? (
          <EmptyState
            icon={<Wallet size={20} />}
            title={t('expenses.empty')}
            description={t('expenses.emptyDesc')}
          />
        ) : (
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            {summary.byCategory.map((item) => {
              const label = item.category || t('expenses.categoryNone')
              const color = tagColor(label)
              const budget = budgetFor(budgets, item.category)
              const progress = budgetProgress(item.cents, budget?.amountCents ?? 0)
              return (
                <div key={item.category || 'none'}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="truncate">{label}</span>
                      <span className="shrink-0 text-faint">· {item.count}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatMoney(item.cents, language)}
                      {budget ? ` / ${formatMoney(budget.amountCents, language)}` : ''}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${Math.max(2, Math.min(100, (item.cents / maxCategory) * 100))}%`,
                        background: progress?.over ? 'var(--danger)' : color,
                      }}
                    />
                  </div>
                  {progress ? (
                    <p className={`mt-1 text-[10px] ${progress.over ? 'text-danger' : 'text-faint'}`}>
                      {progress.over
                        ? t('expenses.overBudget', {
                            amount: formatMoney(Math.abs(progress.remainingCents), language),
                          })
                        : t('expenses.budgetRemaining', {
                            amount: formatMoney(progress.remainingCents, language),
                          })}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title={t('expenses.month')} />
        {monthEntries.length === 0 ? (
          <EmptyState title={t('expenses.empty')} description={t('expenses.emptyDesc')} />
        ) : (
          <div className="space-y-1.5">
            {monthEntries.map((entry) => {
              const label = entry.category || t('expenses.categoryNone')
              const isExpense = entry.type === 'expense'
              return (
                <div
                  key={entry.id}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isExpense ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                    }`}
                  >
                    {isExpense ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{entry.description}</p>
                    <p className="truncate text-[11px] text-muted">
                      {label} · {formatDate(entry.date, 'd MMM', locale)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      isExpense ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {isExpense ? '−' : '+'}
                    {formatMoney(entry.amountCents, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(entry)}
                    aria-label={t('expenses.delete')}
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

      <BudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        budgets={budgets}
        categories={categories}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1 truncate text-base font-semibold tabular-nums tracking-tight ${className ?? ''}`}>
        {value}
      </p>
    </div>
  )
}

function BudgetModal({
  open,
  onClose,
  budgets,
  categories,
}: {
  open: boolean
  onClose: () => void
  budgets: Budget[]
  categories: string[]
}) {
  const { t } = useI18n()
  const [overall, setOverall] = useState('')
  const [rows, setRows] = useState<{ category: string; value: string }[]>([])
  const initialCategories = useRef<string[]>([])

  useEffect(() => {
    if (!open) return
    const overallBudget = budgetFor(budgets, '')
    setOverall(overallBudget ? toInput(overallBudget.amountCents) : '')
    const categoryBudgets = budgets.filter((budget) => budget.category !== '')
    setRows(
      categoryBudgets.map((budget) => ({
        category: budget.category,
        value: toInput(budget.amountCents),
      })),
    )
    initialCategories.current = categoryBudgets.map((budget) => budget.category)
  }, [open, budgets])

  const save = async () => {
    await setBudget('', parseAmountToCents(overall) ?? 0)
    for (const row of rows) {
      const name = row.category.trim()
      if (!name) continue
      await setBudget(name, parseAmountToCents(row.value) ?? 0)
    }
    const removed = initialCategories.current.filter(
      (category) => !rows.some((row) => row.category.trim() === category),
    )
    for (const category of removed) await setBudget(category, 0)
    toast.success(t('expenses.budgetSaved'))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('expenses.budgetTitle')}
      description={t('expenses.budgetSubtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('expenses.budgetSave')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('expenses.overallBudget')} hint={t('expenses.overallBudgetHint')} htmlFor="budget-overall">
          <Input
            id="budget-overall"
            value={overall}
            onChange={(event) => setOverall(event.target.value)}
            placeholder={t('expenses.amountPlaceholder')}
            inputMode="decimal"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('expenses.categoryBudget')}
          </p>
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={`${row.category}-${index}`} className="flex items-center gap-2">
                <Input
                  value={row.category}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, category: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('expenses.categoryBudgetPlaceholder')}
                  list="expense-categories"
                  className="flex-1"
                />
                <Input
                  value={row.value}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('expenses.amountPlaceholder')}
                  inputMode="decimal"
                  className="w-28"
                />
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={t('expenses.removeBudget')}
                  className="rounded-lg p-2 text-faint hover:bg-danger/10 hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button
            variant="soft"
            size="sm"
            className="mt-2"
            onClick={() => setRows((current) => [...current, { category: '', value: '' }])}
          >
            <Plus size={14} /> {t('expenses.addCategoryBudget')}
          </Button>
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {categories.slice(0, 12).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (rows.some((row) => row.category === value)) return
                  setRows((current) => [...current, { category: value, value: '' }])
                }}
                className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                + {value}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
