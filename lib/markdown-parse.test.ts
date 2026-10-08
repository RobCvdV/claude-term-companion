import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown-parse'

describe('parseInline', () => {
  it('keeps plain text as one span', () => {
    expect(parseInline('just words')).toEqual([{ text: 'just words' }])
  })

  it('reads bold, italic, strike and inline code', () => {
    expect(parseInline('a **b** *c* ~~d~~ `e`')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' ' },
      { text: 'd', strike: true },
      { text: ' ' },
      { text: 'e', code: true }
    ])
  })

  it('nests emphasis inside bold', () => {
    expect(parseInline('**very *much* so**')).toEqual([
      { text: 'very ', bold: true },
      { text: 'much', bold: true, italic: true },
      { text: ' so', bold: true }
    ])
  })

  it('reads a link', () => {
    expect(parseInline('see [the PR](https://x.y/1)')).toEqual([
      { text: 'see ' },
      { text: 'the PR', href: 'https://x.y/1' }
    ])
  })

  it('leaves code untouched inside', () => {
    expect(parseInline('`a **b** c`')).toEqual([{ text: 'a **b** c', code: true }])
  })

  it('does not read snake_case or a lone asterisk as emphasis', () => {
    expect(parseInline('file_name_here and 2 * 3')).toEqual([{ text: 'file_name_here and 2 * 3' }])
  })
})

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and a rule', () => {
    expect(parseMarkdown('## Title\n\nline one\nline two\n\n---')).toEqual([
      { type: 'heading', level: 2, spans: [{ text: 'Title' }] },
      { type: 'paragraph', spans: [{ text: 'line one\nline two' }] },
      { type: 'rule' }
    ])
  })

  it('reads bullets and numbered items with their depth', () => {
    expect(parseMarkdown('- a\n  - b\n1. c\n2) d')).toEqual([
      { type: 'item', depth: 0, marker: '•', spans: [{ text: 'a' }] },
      { type: 'item', depth: 1, marker: '•', spans: [{ text: 'b' }] },
      { type: 'item', depth: 0, marker: '1.', spans: [{ text: 'c' }] },
      { type: 'item', depth: 0, marker: '2.', spans: [{ text: 'd' }] }
    ])
  })

  it('keeps a fenced block verbatim', () => {
    expect(parseMarkdown('```ts\nconst a = **1**\n```\nafter')).toEqual([
      { type: 'code', text: 'const a = **1**' },
      { type: 'paragraph', spans: [{ text: 'after' }] }
    ])
  })

  it('reads a table', () => {
    expect(parseMarkdown('| Step | Result |\n|---|:--:|\n| build | **ok** |')).toEqual([
      {
        type: 'table',
        header: [[{ text: 'Step' }], [{ text: 'Result' }]],
        rows: [[[{ text: 'build' }], [{ text: 'ok', bold: true }]]]
      }
    ])
  })

  it('reads a quote', () => {
    expect(parseMarkdown('> careful')).toEqual([{ type: 'quote', spans: [{ text: 'careful' }] }])
  })

  it('does not take a line with a pipe for a table', () => {
    expect(parseMarkdown('a | b')).toEqual([{ type: 'paragraph', spans: [{ text: 'a | b' }] }])
  })
})
