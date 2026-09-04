import { create } from 'zustand'
import type {
  CompanionSession,
  ConversationTurn,
  PendingPrompt,
  PromptDecision,
  ServerFrame
} from './frames'
import type { ClientStatus, CompanionClient, Connection } from './client'
import { activeHost, forget, key, remember, EMPTY_BOOK, type HostBook, type SavedHost } from './hosts'
import { saveBook } from './secure-store'

interface Conversation {
  turns: ConversationTurn[]
  /** turns that exist before the window we hold */
  before: number
}

interface Screen {
  rows: string[]
  at: number
}

interface State {
  client: CompanionClient | null
  /** every Mac this phone is paired with, and which one is live */
  book: HostBook
  /** where the client is pointed right now — an unsaved pairing attempt included */
  connection: Connection | null
  status: ClientStatus
  detail: string | null
  hostName: string | null
  sessions: Record<string, CompanionSession>
  prompts: Record<string, PendingPrompt>
  conversations: Record<string, Conversation>
  screens: Record<string, Screen>
  /** the last thing the host complained about, for a transient banner */
  notice: string | null

  attach: (client: CompanionClient, book: HostBook) => void
  setStatus: (status: ClientStatus, detail?: string) => void
  apply: (frame: ServerFrame) => void
  clearNotice: () => void

  beginPair: (connection: Connection, code: string) => void
  switchTo: (hostKey: string) => void
  forgetHost: (hostKey: string) => void
  /** Go back to the saved live Mac — used when a pairing attempt is abandoned. */
  restoreActive: () => void

  decide: (promptId: string, decision: PromptDecision) => void
  submit: (tabId: string, text: string) => void
  watch: (tabId: string) => void
  unwatch: () => void
  refreshScreen: (tabId: string) => void
  refreshSessions: () => void
}

/** Everything that belongs to one Mac, and must not survive a switch to another. */
const empty = {
  sessions: {},
  prompts: {},
  conversations: {},
  screens: {},
  notice: null,
  hostName: null,
  detail: null
}

/**
 * True when nothing can be sent right now, having said so on the way out.
 * The detail carries the host's own words when it gave any — "this Mac revoked
 * this phone" is a great deal more use than a screen that stops responding.
 */
function offline(get: () => State, set: (partial: Partial<State>) => void): boolean {
  const { client, status, detail } = get()
  if (client && status === 'ready') return false
  set({ notice: detail ?? 'Not connected to the Mac — nothing was sent' })
  return true
}

export const useStore = create<State>((set, get) => ({
  client: null,
  book: EMPTY_BOOK,
  connection: null,
  status: 'idle',
  ...empty,

  attach: (client, book) =>
    set({ client, book, connection: activeHost(book), ...empty, status: 'idle' }),
  setStatus: (status, detail) => set({ status, detail: detail ?? null }),
  clearNotice: () => set({ notice: null }),

  apply: (frame) =>
    set((state) => {
      switch (frame.type) {
        case 'challenge':
          return { hostName: frame.hostName }

        case 'ready': {
          const sessions = Object.fromEntries(frame.sessions.map((s) => [s.tabId, s]))
          if (!state.connection) return { sessions }
          // Only now is it worth remembering — a host written down before this
          // point left the app believing it was paired when it was not.
          const book = remember(state.book, {
            host: state.connection.host,
            port: state.connection.port,
            ...(state.hostName ? { name: state.hostName } : {})
          })
          void saveBook(book)
          return { book, sessions }
        }

        case 'sessions':
          return { sessions: Object.fromEntries(frame.sessions.map((s) => [s.tabId, s])) }

        case 'session':
          return { sessions: { ...state.sessions, [frame.session.tabId]: frame.session } }

        case 'prompt':
          return { prompts: { ...state.prompts, [frame.prompt.id]: frame.prompt } }

        case 'promptResolved': {
          // whoever answered it — this phone, another one, or the terminal
          const prompts = { ...state.prompts }
          delete prompts[frame.promptId]
          return { prompts }
        }

        case 'conversation':
          return {
            conversations: {
              ...state.conversations,
              [frame.tabId]: { turns: frame.turns, before: frame.before }
            }
          }

        case 'conversationDelta': {
          const existing = state.conversations[frame.tabId]
          return {
            conversations: {
              ...state.conversations,
              [frame.tabId]: {
                turns: [...(existing?.turns ?? []), ...frame.turns],
                before: existing?.before ?? 0
              }
            }
          }
        }

        case 'screen':
          return {
            screens: { ...state.screens, [frame.tabId]: { rows: frame.rows, at: frame.at } }
          }

        case 'submitQueued':
          return { notice: 'Held until the session finishes its dialog' }

        case 'submitDelivered':
          return { notice: 'Prompt sent' }

        case 'ruleAdded':
          return {
            notice: frame.added ? `Won't ask again: ${frame.rule}` : `Could not save ${frame.rule}`
          }

        case 'error':
          return { notice: frame.message }

        default:
          return {}
      }
    }),

  beginPair: (connection, code) => {
    // Not written to the book yet: only a host that accepts us gets remembered.
    set({ connection, ...empty, status: 'pairing' })
    get().client?.pair(connection, code)
  },

  switchTo: (hostKey) => {
    const state = get()
    if (state.book.active === hostKey) return
    const next = state.book.hosts.find((h) => key(h) === hostKey)
    if (!next) return
    const book = { hosts: state.book.hosts, active: hostKey }
    void saveBook(book)
    set({ book, connection: next, ...empty, hostName: next.name ?? null, status: 'connecting' })
    state.client?.connect(next)
  },

  forgetHost: (hostKey) => {
    const state = get()
    const book = forget(state.book, hostKey)
    void saveBook(book)
    if (state.book.active !== hostKey) {
      set({ book })
      return
    }
    const next = activeHost(book)
    set({ book, connection: next, ...empty, status: next ? 'connecting' : 'idle' })
    if (next) state.client?.connect(next)
    else state.client?.disconnect()
  },

  restoreActive: () => {
    const state = get()
    const next = activeHost(state.book)
    if (next && state.connection && key(state.connection) === key(next)) return
    set({ connection: next, ...empty, status: next ? 'connecting' : 'idle' })
    if (next) state.client?.connect(next)
    else state.client?.disconnect()
  },

  // A tap that cannot reach the Mac has to say so. `send` drops anything that
  // is not on a live connection, so revoking a phone mid-session — or any lost
  // socket — made the session screen look frozen: it kept showing everything
  // and answered nothing. Only the actions a person takes report this; the
  // background refreshes stay quiet.
  decide: (promptId, decision) => {
    if (!offline(get, set)) get().client?.send({ type: 'decide', promptId, decision })
  },
  submit: (tabId, text) => {
    if (!offline(get, set)) get().client?.send({ type: 'submit', tabId, text })
  },
  watch: (tabId) => get().client?.send({ type: 'subscribe', tabId }),
  unwatch: () => get().client?.send({ type: 'unsubscribe' }),
  refreshScreen: (tabId) => get().client?.send({ type: 'screen', tabId }),
  refreshSessions: () => get().client?.send({ type: 'sessions' })
}))

/** Sessions worth showing, most demanding first. */
export function sortedSessions(sessions: Record<string, CompanionSession>): CompanionSession[] {
  const rank = (s: CompanionSession): number =>
    s.activity === 'needs-attention' ? 0 : s.activity === 'busy' ? 1 : 2
  return Object.values(sessions).sort(
    (a, b) => rank(a) - rank(b) || a.folder.localeCompare(b.folder)
  )
}

/** The Macs in the order the switcher should show them: live one first. */
export function orderedHosts(book: HostBook): SavedHost[] {
  return [...book.hosts].sort(
    (a, b) => Number(key(b) === book.active) - Number(key(a) === book.active)
  )
}
