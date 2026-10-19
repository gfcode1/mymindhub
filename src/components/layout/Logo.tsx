export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon.svg`}
      alt="BinHub"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    />
  )
}
