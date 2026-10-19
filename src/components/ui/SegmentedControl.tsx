import { cn } from '@/lib/utils'

interface SegmentedControlProps<T extends string> {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-raised p-1', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
              active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
            aria-pressed={active}
          >
            {option.label}
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'rounded-md px-1 text-[10px] tabular-nums',
                  active ? 'bg-accent-soft text-accent' : 'bg-line/60 text-muted',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
