import { describe, expect, it } from 'vitest'
import type { ConversationTurn } from './frames'
import { feedItems, preview, resultSummary, toolArg, toolName } from './turn-view'

const t = (over: Partial<ConversationTurn>): ConversationTurn => ({
  role: 'tool',
  time: null,
  text: 'x',
  ...over
})

describe('feedItems', () => {
  it('folds each result under its call, in order for parallel calls', () => {
    const a = t({ tool: 'Read', text: 'file_path: a' })
    const b = t({ tool: 'Read', text: 'file_path: b' })
    const ra = t({ result: true, text: 'A' })
    const rb = t({ result: true, text: 'B' })
    const said = t({ role: 'claude', text: 'done' })
    expect(feedItems([a, b, ra, rb, said])).toEqual([
      { turn: a, result: ra },
      { turn: b, result: rb },
      { turn: said }
    ])
  })

  it('keeps a result whose call is out of the window on its own', () => {
    const r = t({ result: true })
    expect(feedItems([r])).toEqual([{ turn: r }])
  })

  it('pairs results from a host that does not flag them', () => {
    const call = t({ tool: 'Bash' })
    const out = t({ text: 'ok' })
    expect(feedItems([call, out])).toEqual([{ turn: call, result: out }])
  })

  it('does not pair across something said', () => {
    const call = t({ tool: 'Bash' })
    const said = t({ role: 'claude', text: 'hm' })
    const out = t({ result: true })
    expect(feedItems([call, said, out])).toHaveLength(3)
  })
})

describe('toolName', () => {
  it('reads an MCP tool the way the terminal does', () => {
    expect(toolName('Bash')).toBe('Bash')
    expect(toolName('mcp__claude_ai_Atlassian__getJiraIssue')).toBe(
      'Atlassian - getJiraIssue (MCP)'
    )
    expect(toolName('mcp__context7__query-docs')).toBe('context7 - query-docs (MCP)')
  })
})

describe('toolArg', () => {
  it("prefers the host's argument, else the first input line", () => {
    expect(toolArg(t({ tool: 'Bash', arg: 'ls' }))).toBe('ls')
    expect(toolArg(t({ tool: 'Bash', text: 'command: npm test\ndescription: run' }))).toBe(
      'npm test'
    )
  })
})

describe('preview', () => {
  it('shows the first lines and counts the rest', () => {
    expect(preview('a\nb\nc\nd\ne\n')).toEqual({ shown: 'a\nb\nc', more: 2, cut: true })
    expect(preview('a\nb')).toEqual({ shown: 'a\nb', more: 0, cut: false })
  })

  it('cuts a very long line', () => {
    const p = preview('y'.repeat(500))
    expect(p.shown).toHaveLength(161)
    expect(p).toMatchObject({ more: 0, cut: true })
  })
})

describe('resultSummary', () => {
  it('counts what a Read returned, and leaves a failure in full', () => {
    const read = t({ tool: 'Read' })
    expect(resultSummary(read, t({ result: true, text: '1→a\n2→b\n' }))).toBe('Read 2 lines')
    expect(resultSummary(read, t({ result: true, error: true, text: 'no file' }))).toBeUndefined()
    expect(resultSummary(t({ tool: 'Bash' }), t({ result: true }))).toBeUndefined()
  })
})
