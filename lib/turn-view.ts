import type { ConversationTurn } from './frames'

/** What the feed draws: a turn, with a tool call's result folded under it. */
export interface FeedItem {
  turn: ConversationTurn
  result?: ConversationTurn
}

/**
 * Pair each tool call with its result, as the terminal draws them. Parallel
 * calls are followed by their results in the same order, so the oldest unpaired
 * call takes the next result.
 */
export function feedItems(turns: readonly ConversationTurn[]): FeedItem[] {
  const items: FeedItem[] = []
  let open: FeedItem[] = []
  for (const turn of turns) {
    if (isCall(turn)) {
      const item = { turn }
      items.push(item)
      open.push(item)
    } else if (isResult(turn) && open.length) {
      open.shift()!.result = turn
    } else {
      items.push({ turn })
      if (turn.role !== 'tool') open = []
    }
  }
  return items
}

export function isCall(turn: ConversationTurn): boolean {
  return turn.role === 'tool' && Boolean(turn.tool)
}

/** A host older than the `result` flag sends a result as a nameless tool turn. */
function isResult(turn: ConversationTurn): boolean {
  return turn.role === 'tool' && !turn.tool && turn.result !== false
}

/** `Bash`, or `Atlassian - getJiraIssue (MCP)` for an MCP tool. */
export function toolName(tool: string): string {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (!mcp) return tool
  const server = mcp[1].replace(/^(claude_ai|plugin)_/, '').split('_').pop() ?? mcp[1]
  return `${server} - ${mcp[2]} (MCP)`
}

/** The call's argument, or the first input line from a host that sends none. */
export function toolArg(turn: ConversationTurn): string {
  if (turn.arg) return turn.arg
  const first = turn.text.trim().split('\n')[0] ?? ''
  return first.replace(/^[\w-]+: /, '')
}

const PREVIEW_LINES = 3
const PREVIEW_LINE_CHARS = 160

/** The first few lines of a long text, and how many more there are. */
export function preview(
  text: string,
  lines = PREVIEW_LINES
): { shown: string; more: number; cut: boolean } {
  const all = text.replace(/\s+$/, '').replace(/^\n+/, '').split('\n')
  const shown = all
    .slice(0, lines)
    .map((l) => (l.length > PREVIEW_LINE_CHARS ? `${l.slice(0, PREVIEW_LINE_CHARS)}…` : l))
  const more = Math.max(0, all.length - lines)
  return { shown: shown.join('\n'), more, cut: more > 0 || shown.some((l, i) => l !== all[i]) }
}

/** The one-liner the terminal shows instead of some outputs: `Read 120 lines`. */
export function resultSummary(call: ConversationTurn, result: ConversationTurn): string | undefined {
  if (result.error) return undefined
  if (call.tool === 'Read') {
    const lines = result.text.replace(/\s+$/, '').split('\n').length
    return `Read ${lines} ${lines === 1 ? 'line' : 'lines'}`
  }
  return undefined
}
