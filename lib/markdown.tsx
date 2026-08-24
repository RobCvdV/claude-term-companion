import { StyleSheet, Text, View } from 'react-native'
import { theme } from './theme'

/**
 * Enough markdown to read a plan: headings, bullets, fenced code and emphasis
 * stripped back to plain text.
 *
 * A full renderer would mean a dependency whose React peers fight Expo's, for
 * output nobody edits — a plan is read once and approved.
 */
export function Markdownish({ source }: { source: string }): React.JSX.Element {
  const blocks: React.JSX.Element[] = []
  let code: string[] | null = null
  const flushCode = (key: string, lines: string[]): void => {
    blocks.push(
      <Text key={key} style={styles.code}>
        {lines.join('\n')}
      </Text>
    )
  }

  source.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('```')) {
      if (code) {
        flushCode(String(i), code)
        code = null
      } else {
        code = []
      }
      return
    }
    if (code) {
      code.push(line)
      return
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push(
        <Text key={i} style={[styles.heading, heading[1].length > 2 && styles.subHeading]}>
          {inline(heading[2])}
        </Text>
      )
      return
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      blocks.push(
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>·</Text>
          <Text style={styles.body}>{inline(bullet[1])}</Text>
        </View>
      )
      return
    }
    if (!line.trim()) {
      blocks.push(<View key={i} style={styles.gap} />)
      return
    }
    blocks.push(
      <Text key={i} style={styles.body}>
        {inline(line)}
      </Text>
    )
  })

  if (code) flushCode('tail', code)
  return <View>{blocks}</View>
}

/** Emphasis and inline code carry no meaning here, so drop the markers. */
function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

const styles = StyleSheet.create({
  heading: { color: theme.text, fontSize: 17, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  subHeading: { fontSize: 15 },
  body: { color: theme.dim, fontSize: 14, lineHeight: 20, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bullet: { color: theme.faint, fontSize: 14, lineHeight: 20 },
  code: {
    color: theme.accent,
    fontFamily: theme.mono,
    fontSize: 12,
    backgroundColor: theme.bg,
    borderRadius: 6,
    padding: 8,
    marginVertical: 6
  },
  gap: { height: 8 }
})
