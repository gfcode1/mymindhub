import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_20px_-10px_var(--accent)] hover:brightness-105 active:brightness-95',
  secondary: 'bg-raised text-ink border border-line hover:bg-line/40',
  ghost: 'text-ink hover:bg-raised active:bg-line/50',
  danger: 'bg-danger text-danger-ink hover:brightness-105 active:brightness-95',
  soft: 'bg-accent-soft text-accent hover:brightness-105 active:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-[background,color,transform,filter] duration-150 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985]',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  size = 'icon',
  variant = 'ghost',
  children,
  ...props
}: ButtonProps & { label: string }) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn('shrink-0', className)}
      {...props}
    >
      {children}
    </Button>
  )
}
