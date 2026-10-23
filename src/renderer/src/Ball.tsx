import { useId } from 'react'

export interface BallStyle {
  top: string
  accent: string
}

export const BALLS: BallStyle[] = [
  { top: '#e3350d', accent: '#ffffff' },
  { top: '#3b6fd4', accent: '#e3350d' },
  { top: '#f2c200', accent: '#222533' },
  { top: '#7b3fb8', accent: '#ff5fa2' }
]

export function Ball({ slot, size = 28, dim = false }: { slot: number; size?: number; dim?: boolean }) {
  const uid = useId()
  const { top, accent } = BALLS[slot % BALLS.length]
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ opacity: dim ? 0.4 : 1, flex: 'none' }}>
      <defs>
        <clipPath id={`${uid}-c`}>
          <circle cx="16" cy="16" r="14" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-c)`}>
        <rect width="32" height="16" fill={top} />
        <rect y="16" width="32" height="16" fill="#f4f5f8" />
        <circle cx="8" cy="8" r="2.4" fill={accent} opacity="0.55" />
      </g>
      <rect x="2" y="14.4" width="28" height="3.2" fill="#1b1d29" />
      <circle cx="16" cy="16" r="14" fill="none" stroke="#1b1d29" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="5" fill="#f4f5f8" stroke="#1b1d29" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2" fill={accent === '#ffffff' ? '#cfd3e0' : accent} />
    </svg>
  )
}
