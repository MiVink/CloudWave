import { useId, type JSX } from 'react'

export interface BrandMarkProps {
  className?: string
  /** Decorative by default; pass a title when the mark stands alone. */
  title?: string
}

/**
 * Cloudwave mark: a rounded tile holding three rising sound bars inside an
 * implied wave. Uses the live accent tokens so it re-themes with the app.
 */
export function BrandMark({ className = 'brand-mark', title }: BrandMarkProps): JSX.Element {
  const gradientId = useId().replace(/:/g, '')

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-hi)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path
        d="M7 20.5c2.1-5.4 4.2-5.4 6.2 0s4.2 5.4 6.3 0 4.1-5.4 6.2 0"
        stroke="var(--accent-ink)"
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.92"
      />
      <path
        d="M10.5 23.6h2.2M15.4 23.6h2.2M20.3 23.6h2.2"
        stroke="var(--accent-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.42"
      />
    </svg>
  )
}
