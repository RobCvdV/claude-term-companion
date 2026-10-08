import { Linking, StyleSheet, Text, View, type TextStyle } from 'react-native'
import { parseMarkdown, type Block, type Span } from './markdown-parse'
import { theme } from './theme'

/**
 * The markdown a session prints, drawn natively: emphasis, code, lists, quotes,
 * tables and links. `base` sets the colour and size the text starts from, so a
 * thinking block can stay dim and italic.
 */
export function Markdown({
  source,
  base
}: {
  source: string
  base?: TextStyle
}): React.JSX.Element {
  return (
    <View>
      {parseMarkdown(source).map((block, i) => (
        <BlockView key={i} block={block} base={[styles.body, base]} first={i === 0} />
      ))}
    </View>
  )
}

function Spans({ spans }: { spans: Span[] }): React.JSX.Element {
  return (
    <>
      {spans.map((s, i) => (
        <Text
          key={i}
          style={[
            s.bold && styles.bold,
            s.italic && styles.italic,
            s.strike && styles.strike,
            s.code && styles.inlineCode,
            s.href !== undefined && styles.link
          ]}
          onPress={s.href ? () => void Linking.openURL(s.href as string) : undefined}
        >
          {s.text}
        </Text>
      ))}
    </>
  )
}

function BlockView({
  block,
  base,
  first
}: {
  block: Block
  base: (TextStyle | undefined)[]
  first: boolean
}): React.JSX.Element {
  switch (block.type) {
    case 'heading':
      return (
        <Text
          style={[base, styles.heading, block.level > 2 && styles.subHeading, first && styles.flush]}
        >
          <Spans spans={block.spans} />
        </Text>
      )
    case 'paragraph':
      return (
        <Text style={[base, styles.paragraph]}>
          <Spans spans={block.spans} />
        </Text>
      )
    case 'item':
      return (
        <View style={[styles.itemRow, { paddingLeft: 4 + block.depth * 14 }]}>
          <Text style={[base, styles.marker]}>{block.marker}</Text>
          <Text style={[base, styles.itemText]}>
            <Spans spans={block.spans} />
          </Text>
        </View>
      )
    case 'quote':
      return (
        <View style={styles.quote}>
          <Text style={[base, styles.quoteText]}>
            <Spans spans={block.spans} />
          </Text>
        </View>
      )
    case 'code':
      return <Text style={styles.code}>{block.text}</Text>
    case 'rule':
      return <View style={styles.rule} />
    case 'table':
      return (
        <View style={styles.table}>
          {[block.header, ...block.rows].map((row, r) => (
            <View key={r} style={[styles.tableRow, r === 0 && styles.tableHead]}>
              {row.map((cell, c) => (
                <Text key={c} style={[base, styles.cell, r === 0 && styles.bold]}>
                  <Spans spans={cell} />
                </Text>
              ))}
            </View>
          ))}
        </View>
      )
  }
}

const styles = StyleSheet.create({
  body: { color: theme.dim, fontSize: 14, lineHeight: 20 },
  paragraph: { marginBottom: 6 },
  heading: { color: theme.text, fontSize: 17, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  subHeading: { fontSize: 15 },
  // level with the turn's marker
  flush: { marginTop: 0 },
  bold: { fontWeight: '700', color: theme.text },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  inlineCode: { fontFamily: theme.mono, fontSize: 12.5, color: theme.accent },
  link: { color: theme.accent, textDecorationLine: 'underline' },
  itemRow: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  marker: { color: theme.faint, minWidth: 12 },
  itemText: { flex: 1 },
  quote: { borderLeftWidth: 2, borderLeftColor: theme.border, paddingLeft: 10, marginBottom: 6 },
  quoteText: { color: theme.faint },
  code: {
    color: theme.accent,
    fontFamily: theme.mono,
    fontSize: 12,
    backgroundColor: theme.bg,
    borderRadius: 6,
    padding: 8,
    marginVertical: 6
  },
  rule: { height: 1, backgroundColor: theme.border, marginVertical: 10 },
  table: { borderWidth: 1, borderColor: theme.border, borderRadius: 6, marginVertical: 6 },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.border },
  tableHead: { borderTopWidth: 0, backgroundColor: theme.panelHi },
  cell: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, fontSize: 12.5, lineHeight: 17 }
})
