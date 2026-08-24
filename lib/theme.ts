/** One palette, dark by default: this app gets opened in the evening. */
export const theme = {
  bg: '#0f1115',
  panel: '#171a21',
  panelHi: '#1f232c',
  border: '#2a2f3a',
  text: '#e6e8ee',
  dim: '#9aa1ae',
  faint: '#646b78',
  accent: '#7aa2f7',
  good: '#9ece6a',
  warn: '#e0af68',
  bad: '#f7768e',
  mono: 'Menlo'
} as const

/** What each activity state should look like at a glance. */
export function activityColor(activity: string): string {
  if (activity === 'needs-attention') return theme.warn
  if (activity === 'busy') return theme.accent
  if (activity === 'exited' || activity === 'ended') return theme.faint
  return theme.good
}

export function activityLabel(activity: string): string {
  if (activity === 'needs-attention') return 'waiting for you'
  if (activity === 'busy') return 'working'
  if (activity === 'exited') return 'exited'
  if (activity === 'ended') return 'ended'
  return 'idle'
}
