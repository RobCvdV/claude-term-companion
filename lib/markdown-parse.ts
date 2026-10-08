/**
 * The markdown Claude writes, parsed into plain data so the phone can draw it.
 *
 * Covers what a session actually prints — headings, lists, quotes, fences,
 * tables, rules and inline emphasis — rather than all of CommonMark.
 */

export interface Span {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
  href?: string
}

export type Block =
  | { type: 'heading'; level: number; spans: Span[] }
  | { type: 'paragraph'; spans: Span[] }
  | { type: 'item'; depth: number; marker: string; spans: Span[] }
  | { type: 'quote'; spans: Span[] }
  | { type: 'code'; text: string }
  | { type: 'table'; header: Span[][]; rows: Span[][][] }
  | { type: 'rule' }

const INLINE =
  /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\[([^\]]+)\]\(([^)\s]+)\)|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\*)|(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g

/** Inline emphasis, code and links; `inherit` carries an outer style inward. */
export function parseInline(text: string, inherit: Omit<Span, 'text'> = {}): Span[] {
  const spans: Span[] = []
  const push = (t: string, style: Omit<Span, 'text'> = {}): void => {
    if (t) spans.push({ text: t, ...inherit, ...style })
  }
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    push(text.slice(last, m.index))
    const [, code, bold1, bold2, strike, label, href, em1, em2] = m
    if (code !== undefined) push(code, { code: true })
    else if (bold1 ?? bold2) spans.push(...parseInline(bold1 ?? bold2, { ...inherit, bold: true }))
    else if (strike !== undefined) spans.push(...parseInline(strike, { ...inherit, strike: true }))
    else if (label !== undefined) spans.push(...parseInline(label, { ...inherit, href }))
    else spans.push(...parseInline(em1 ?? em2, { ...inherit, italic: true }))
    last = (m.index ?? 0) + m[0].length
  }
  push(text.slice(last))
  return spans
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

const isTableRule = (line: string): boolean => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flush = (): void => {
    if (para.length) blocks.push({ type: 'paragraph', spans: parseInline(para.join('\n')) })
    para = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const fence = /^\s*(```|~~~)/.exec(line)
    if (fence) {
      flush()
      const body: string[] = []
      while (++i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i])
      blocks.push({ type: 'code', text: body.join('\n') })
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      flush()
      const header = cells(line).map((c) => parseInline(c))
      const rows: Span[][][] = []
      i += 1
      while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) {
        rows.push(cells(lines[++i]).map((c) => parseInline(c)))
      }
      blocks.push({ type: 'table', header, rows })
      continue
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', level: heading[1].length, spans: parseInline(heading[2]) })
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush()
      blocks.push({ type: 'rule' })
      continue
    }

    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (item) {
      flush()
      const marker = /\d/.test(item[2]) ? item[2].replace(')', '.') : '•'
      const depth = Math.floor(item[1].replace(/\t/g, '  ').length / 2)
      blocks.push({ type: 'item', depth, marker, spans: parseInline(item[3]) })
      continue
    }

    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      flush()
      blocks.push({ type: 'quote', spans: parseInline(quote[1]) })
      continue
    }

    if (!line.trim()) flush()
    else para.push(line)
  }
  flush()
  return blocks
}
