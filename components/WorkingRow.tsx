import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { elapsed, spinnerWord, toolLine } from '../lib/doing'
import type { CompanionSession } from '../lib/frames'
import { theme } from '../lib/theme'

/** The terminal's own spinner frames, kept from turning into emoji. */
const FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'].map((f) => `${f}\uFE0E`)

/** The terminal's "Tinkering… (1m 05s)" line, for a session that is working. */
export function WorkingRow({ session }: { session: CompanionSession }): React.JSX.Element {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 200)
    return () => clearInterval(timer)
  }, [])

  const tool = toolLine(session)
  const steps = session.doing?.steps ?? 0
  const meta = [
    session.busySince ? elapsed(Date.now() - session.busySince) : null,
    steps > 0 ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : null,
    session.doing?.mode === 'thinking' ? 'thinking' : null
  ].filter(Boolean)

  return (
    <View style={styles.row}>
      <Text style={styles.glyph}>{FRAMES[tick % FRAMES.length]}</Text>
      <View style={styles.body}>
        <Text style={styles.word}>
          {spinnerWord(session)}
          {meta.length ? <Text style={styles.meta}>  ({meta.join(' · ')})</Text> : null}
        </Text>
        {tool ? (
          <Text style={styles.tool} numberOfLines={2}>
            ⎿  {tool}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  glyph: { color: theme.warn, fontSize: 14, width: 14, lineHeight: 20, textAlign: 'center' },
  body: { flex: 1 },
  word: { color: theme.warn, fontSize: 14, lineHeight: 20 },
  meta: { color: theme.faint, fontSize: 12 },
  tool: { color: theme.faint, fontFamily: theme.mono, fontSize: 12, lineHeight: 17, marginTop: 2 }
})
