import { addMonths, format } from 'date-fns'
import type { Language } from '@/types/models'
import type { Budget, Expense } from '@/types/models'

export interface CategorySpend {
  category: string
  cents: number
  count: number
}

export interface ExpenseSummary {
  expensesCents: number
  incomeCents: number
  balanceCents: number
  byCategory: CategorySpend[]
}

export function monthKey(date: Date | string = new Date()): string {
  if (typeof date === 'string') {
    const parsed = date.length === 7 ? new Date(`${date}-01T12:00:00`) : new Date(date)
    return format(Number.isNaN(parsed.getTime()) ? new Date() : parsed, 'yyyy-MM')
  }
  return format(date, 'yyyy-MM')
}

export function shiftMonthKey(key: string, delta: number): string {
  const date = new Date(`${key}-01T12:00:00`)
  return format(addMonths(date, delta), 'yyyy-MM')
}

export function entriesForMonth(entries: Expense[], key: string): Expense[] {
  return entries.filter((entry) => entry.date.startsWith(key))
}

export function summarizeExpenses(entries: Expense[]): ExpenseSummary {
  let expensesCents = 0
  let incomeCents = 0
  const categories = new Map<string, CategorySpend>()

  for (const entry of entries) {
    const cents = Math.max(0, entry.amountCents)
    if (entry.type === 'income') {
      incomeCents += cents
      continue
    }
    expensesCents += cents
    const key = entry.category.trim()
    const current = categories.get(key) ?? { category: key, cents: 0, count: 0 }
    current.cents += cents
    current.count += 1
    categories.set(key, current)
  }

  return {
    expensesCents,
    incomeCents,
    balanceCents: incomeCents - expensesCents,
    byCategory: [...categories.values()].sort((a, b) => b.cents - a.cents),
  }
}

export function budgetFor(budgets: Budget[], category: string): Budget | undefined {
  return budgets.find((budget) => budget.category === category)
}

export function parseAmountToCents(input: string): number | null {
  let value = input.trim().replace(/[€\s]/g, '')
  if (!value) return null
  if (value.includes(',') && value.includes('.')) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else {
    value = value.replace(',', '.')
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

export function formatMoney(cents: number, language: Language): string {
  const locale = language === 'en' ? 'en-US' : 'it-IT'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number.isFinite(cents) ? cents : 0) / 100)
}

export function budgetProgress(spentCents: number, budgetCents: number) {
  if (budgetCents <= 0) return null
  const ratio = spentCents / budgetCents
  return {
    ratio,
    remainingCents: budgetCents - spentCents,
    over: spentCents > budgetCents,
  }
}
