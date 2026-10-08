import { StyleSheet, Text, View } from 'react-native'
import type { ConversationTurn } from '../lib/frames'
import { Markdown } from '../lib/markdown'
import { theme } from '../lib/theme'

const MARK: Record<string, string> = { user: '›', claude: '⏺', thinking: '·', tool: '⚒' }

/** One content block of the conversation, read from the session's transcript. */
export function TurnRow({ turn }: { turn: ConversationTurn }): React.JSX.Element {
  const isUser = turn.role === 'user'
  return (
    <View style={[styles.row, isUser && styles.userRow]}>
      <Text style={[styles.mark, isUser && styles.userMark]}>{MARK[turn.role] ?? '?'}</Text>
      <View style={styles.body}>
        {turn.tool ? <Text style={styles.tool}>{turn.tool}</Text> : null}
        {turn.role === 'tool' ? (
          <Text style={[styles.text, styles.toolText]}>{turn.text.trim()}</Text>
        ) : (
          <Markdown
            source={turn.text.trim()}
            base={StyleSheet.flatten([
              styles.text,
              isUser && styles.userText,
              turn.role === 'thinking' && styles.thinking
            ])}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  userRow: {
    backgroundColor: theme.panel,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 4
  },
  mark: { color: theme.faint, fontSize: 13, width: 14, lineHeight: 20 },
  userMark: { color: theme.accent },
  body: { flex: 1 },
  tool: { color: theme.faint, fontSize: 11, fontFamily: theme.mono, marginBottom: 2 },
  text: { color: theme.dim, fontSize: 14, lineHeight: 20 },
  userText: { color: theme.text },
  thinking: { color: theme.faint, fontStyle: 'italic' },
  toolText: { color: theme.faint, fontFamily: theme.mono, fontSize: 12 }
})
