import { describe, expect, it } from 'vitest'
import {
  budgetProgress,
  entriesForMonth,
  formatMoney,
  monthKey,
  parseAmountToCents,
  shiftMonthKey,
  summarizeExpenses,
} from '@/lib/expenses'
import type { Expense } from '@/types/models'

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    description: 'Pranzo',
    amountCents: 1250,
    category: 'Cibo',
    date: '2026-10-20',
    type: 'expense',
    note: '',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('expenses', () => {
  it('parses amounts with comma or dot', () => {
    expect(parseAmountToCents('12,50')).toBe(1250)
    expect(parseAmountToCents('12.50')).toBe(1250)
    expect(parseAmountToCents('1.234,56')).toBe(123456)
    expect(parseAmountToCents('€ 10')).toBe(1000)
    expect(parseAmountToCents('0')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
  })

  it('formats money by language', () => {
    expect(formatMoney(1250, 'it')).toContain('12,50')
    expect(formatMoney(1250, 'en')).toContain('12.50')
  })

  it('builds and shifts month keys', () => {
    expect(monthKey('2026-10-20')).toBe('2026-10')
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
  })

  it('filters by month and summarizes', () => {
    const entries = [
      expense({ id: 'a', amountCents: 1000, category: 'Cibo' }),
      expense({ id: 'b', amountCents: 500, category: 'Cibo' }),
      expense({ id: 'c', amountCents: 2000, category: 'Casa' }),
      expense({ id: 'd', amountCents: 5000, type: 'income', category: '' }),
      expense({ id: 'e', date: '2026-09-30', amountCents: 9999 }),
    ]
    const current = entriesForMonth(entries, '2026-10')
    expect(current).toHaveLength(4)
    const summary = summarizeExpenses(current)
    expect(summary.expensesCents).toBe(3500)
    expect(summary.incomeCents).toBe(5000)
    expect(summary.balanceCents).toBe(1500)
    expect(summary.byCategory[0]).toEqual({ category: 'Casa', cents: 2000, count: 1 })
    expect(summary.byCategory[1]).toEqual({ category: 'Cibo', cents: 1500, count: 2 })
  })

  it('computes budget progress', () => {
    expect(budgetProgress(3000, 10000)).toEqual({ ratio: 0.3, remainingCents: 7000, over: false })
    expect(budgetProgress(12000, 10000)).toEqual({ ratio: 1.2, remainingCents: -2000, over: true })
    expect(budgetProgress(1000, 0)).toBeNull()
  })
})
