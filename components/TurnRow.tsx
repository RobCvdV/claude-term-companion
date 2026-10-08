import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ConversationTurn } from '../lib/frames'
import { Markdown } from '../lib/markdown'
import { theme } from '../lib/theme'
import { type FeedItem, isCall, preview, resultSummary, toolArg, toolName } from '../lib/turn-view'

/** The terminal's ⏺, which iOS would draw as an emoji. */
const DOT = '●'

/** One entry of the conversation, drawn the way the terminal draws it. */
export function TurnRow({ item }: { item: FeedItem }): React.JSX.Element {
  const { turn, result } = item
  if (isCall(turn)) return <ToolCall call={turn} result={result} />
  if (turn.role === 'tool') return <Output turn={turn} />
  if (turn.role === 'thinking') return <Thinking turn={turn} />

  const isUser = turn.role === 'user'
  return (
    <View style={[styles.row, isUser && styles.userRow]}>
      <Text style={[styles.mark, isUser ? styles.userMark : styles.claudeMark]}>
        {isUser ? '›' : DOT}
      </Text>
      <View style={styles.body}>
        <Markdown
          source={turn.text.trim()}
          base={StyleSheet.flatten([styles.text, isUser && styles.userText])}
        />
      </View>
    </View>
  )
}

/** `⏺ Bash(npm test)` with its output folded under it; tap for all of both. */
function ToolCall({
  call,
  result
}: {
  call: ConversationTurn
  result?: ConversationTurn
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const arg = toolArg(call)
  const dot = !result ? theme.faint : result.error ? theme.bad : theme.good
  return (
    <Pressable style={styles.row} onPress={() => setOpen((o) => !o)}>
      <Text style={[styles.mark, { color: dot }]}>{DOT}</Text>
      <View style={styles.body}>
        <Text style={styles.call} numberOfLines={open ? undefined : 2}>
          <Text style={styles.callName}>{toolName(call.tool ?? '')}</Text>
          {arg ? <Text style={styles.callArg}>({arg})</Text> : null}
        </Text>
        {open ? <Text style={[styles.mono, styles.input]}>{call.text.trim()}</Text> : null}
        {result ? <Folded turn={result} open={open} summary={resultSummary(call, result)} /> : null}
      </View>
    </Pressable>
  )
}

/** Tool output with no call in view: a result, or text a hook injected. */
function Output({ turn }: { turn: ConversationTurn }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <Pressable style={styles.row} onPress={() => setOpen((o) => !o)}>
      <Text style={styles.mark} />
      <View style={styles.body}>
        <Folded turn={turn} open={open} />
      </View>
    </Pressable>
  )
}

/** `⎿  first lines … +N lines`, or everything once opened. */
function Folded({
  turn,
  open,
  summary
}: {
  turn: ConversationTurn
  open: boolean
  summary?: string
}): React.JSX.Element {
  const p = summary ? { shown: summary, more: 0, cut: true } : preview(turn.text)
  return (
    <View style={styles.result}>
      <Text style={styles.elbow}>⎿</Text>
      <View style={styles.body}>
        <Text style={[styles.mono, turn.error && styles.error]}>
          {open ? turn.text.trim() : p.shown}
        </Text>
        {!open && p.cut ? (
          <Text style={styles.more}>
            {p.more > 0
              ? `… +${p.more} ${p.more === 1 ? 'line' : 'lines'}`
              : summary
                ? '(tap to show)'
                : '…'}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function Thinking({ turn }: { turn: ConversationTurn }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <Pressable style={styles.row} onPress={() => setOpen((o) => !o)}>
      <Text style={[styles.mark, styles.thinkingMark]}>{'✻\uFE0E'}</Text>
      <View style={styles.body}>
        <Text style={styles.thinkingHead}>Thinking{open ? '' : '…'}</Text>
        {open ? (
          <Markdown
            source={turn.text.trim()}
            base={StyleSheet.flatten([styles.text, styles.thinking])}
          />
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 5 },
  userRow: {
    backgroundColor: theme.panel,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 4
  },
  mark: { color: theme.faint, fontSize: 12, width: 14, lineHeight: 20 },
  userMark: { color: theme.accent, fontSize: 14 },
  claudeMark: { color: theme.text },
  body: { flex: 1 },
  text: { color: theme.dim, fontSize: 14, lineHeight: 20 },
  userText: { color: theme.text },
  call: { fontSize: 13, lineHeight: 20 },
  callName: { color: theme.text, fontWeight: '700' },
  callArg: { color: theme.dim, fontFamily: theme.mono, fontSize: 12 },
  mono: { color: theme.faint, fontFamily: theme.mono, fontSize: 11, lineHeight: 16 },
  input: { marginTop: 2, marginBottom: 4 },
  result: { flexDirection: 'row', gap: 6, marginTop: 2 },
  elbow: { color: theme.faint, fontFamily: theme.mono, fontSize: 11, lineHeight: 16 },
  error: { color: theme.bad },
  more: { color: theme.faint, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  thinkingMark: { color: theme.faint },
  thinkingHead: { color: theme.faint, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  thinking: { color: theme.faint, fontStyle: 'italic' }
})
