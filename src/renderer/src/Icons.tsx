const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

export const IconExpand = () => (
  <svg {...base}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
)
export const IconGrid = () => (
  <svg {...base}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>
)
export const IconReload = () => (
  <svg {...base}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
)
export const IconSound = () => (
  <svg {...base}><path d="M4 9v6h4l5 4V5L8 9H4zM17 9a4 4 0 0 1 0 6" /></svg>
)
export const IconMute = () => (
  <svg {...base}><path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6" /></svg>
)
export const IconSettings = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
)
