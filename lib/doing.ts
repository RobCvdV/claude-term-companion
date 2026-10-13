import type { CompanionSession } from './frames'

/** `42s`, `3m 05s`, `1h 12m` — how the terminal counts a turn. */
export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** The spinner's word as the terminal draws it, or a stand-in before it has one. */
export function spinnerWord(session: CompanionSession): string {
  const word = session.doing?.word?.trim()
  if (!word) return 'Working…'
  return /[….]$/.test(word) ? word : `${word}…`
}

/** What the running tool is doing, `Bash  npm test`, or null between tools. */
export function toolLine(session: CompanionSession): string | null {
  const tool = session.doing?.tool
  if (!tool) return null
  const detail = session.doing?.detail?.split('\n')[0]
  return detail ? `${tool}  ${detail}` : tool
}

/** What an idle tab is still running — `▶ npm run dev +1` — or null when nothing. */
export function runningSummary(session: CompanionSession): string | null {
  const running = session.running ?? []
  if (running.length === 0) return null
  const first = `▶ ${running[0].label}`
  return running.length === 1 ? first : `${first} +${running.length - 1}`
}

/** One line for a session list row while it works. */
export function doingSummary(session: CompanionSession, now: number): string {
  const parts = [spinnerWord(session)]
  if (session.doing?.tool) parts.push(session.doing.tool)
  if (session.busySince) parts.push(elapsed(now - session.busySince))
  return parts.join('  ·  ')
}
