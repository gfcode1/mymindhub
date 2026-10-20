import { OPENMOJI, type OpenMojiName } from '@/assets/openmoji'
import { cn } from '@/lib/utils'

export function EmojiIcon({
  name,
  className,
  label,
}: {
  name: OpenMojiName
  className?: string
  label?: string
}) {
  return (
    <img
      src={OPENMOJI[name]}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={cn('h-6 w-6 select-none', className)}
      loading="lazy"
      draggable={false}
    />
  )
}
