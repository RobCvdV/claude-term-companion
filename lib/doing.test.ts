import { describe, expect, it } from 'vitest'
import type { CompanionSession } from './frames'
import { doingSummary, elapsed, spinnerWord, toolLine } from './doing'

const session = (over: Partial<CompanionSession> = {}): CompanionSession => ({
  tabId: 't1',
  sessionId: 's1',
  folder: 'app',
  cwd: '/x/app',
  activity: 'busy',
  busySince: 1_000,
  claudeActive: true,
  branch: null,
  model: null,
  pendingPromptIds: [],
  ...over
})

const doing = { word: 'Tinkering', mode: 'tool-use', tool: 'Bash', detail: 'npm test\n--ci', steps: 2 }

describe('elapsed', () => {
  it('counts like the terminal does', () => {
    expect(elapsed(42_400)).toBe('42s')
    expect(elapsed(185_000)).toBe('3m 05s')
    expect(elapsed(4_320_000)).toBe('1h 12m')
    expect(elapsed(-5)).toBe('0s')
  })
})

describe('spinnerWord', () => {
  it('adds the ellipsis the terminal draws, once', () => {
    expect(spinnerWord(session({ doing }))).toBe('Tinkering…')
    expect(spinnerWord(session({ doing: { ...doing, word: 'Compacting…' } }))).toBe('Compacting…')
  })

  it('stands in until the spinner has a word, or for an older host', () => {
    expect(spinnerWord(session({ doing: { ...doing, word: '' } }))).toBe('Working…')
    expect(spinnerWord(session())).toBe('Working…')
  })
})

describe('toolLine', () => {
  it("names the tool and the first line of what it's running", () => {
    expect(toolLine(session({ doing }))).toBe('Bash  npm test')
    expect(toolLine(session({ doing: { ...doing, detail: null } }))).toBe('Bash')
    expect(toolLine(session({ doing: { ...doing, tool: null } }))).toBeNull()
  })
})

describe('doingSummary', () => {
  it('puts word, tool and time on one line', () => {
    expect(doingSummary(session({ doing }), 63_000)).toBe('Tinkering…  ·  Bash  ·  1m 02s')
    expect(doingSummary(session({ busySince: null }), 0)).toBe('Working…')
  })
})
