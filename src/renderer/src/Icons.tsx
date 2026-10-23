const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

export const IconExpand = () => (
  <svg {...base}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
)
export const IconGrid = () => (
  <svg {...base}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
)
export const IconReload = () => (
  <svg {...base}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
)
export const IconSound = () => (
  <svg {...base}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
)
export const IconMute = () => (
  <svg {...base}><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
)
export const IconSettings = () => (
  <svg {...base}>
    <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" />
    <circle cx="16" cy="6" r="2.2" /><circle cx="10" cy="12" r="2.2" /><circle cx="18" cy="18" r="2.2" />
  </svg>
)
export const IconDownload = () => (
  <svg {...base}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
)
export const IconClose = () => (
  <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
