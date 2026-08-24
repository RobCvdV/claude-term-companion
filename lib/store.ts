import { create } from 'zustand'
import type {
  CompanionSession,
  ConversationTurn,
  PendingPrompt,
  PromptDecision,
  ServerFrame
} from './frames'
import type { ClientStatus, CompanionClient, Connection } from './client'
import { saveConnection as persist } from './secure-store'

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

  attach: (client: CompanionClient, connection: Connection) => void
  setStatus: (status: ClientStatus, detail?: string) => void
  apply: (frame: ServerFrame) => void
  clearNotice: () => void
  reset: () => void

  decide: (promptId: string, decision: PromptDecision) => void
  submit: (tabId: string, text: string) => void
  watch: (tabId: string) => void
  unwatch: () => void
  refreshScreen: (tabId: string) => void
  refreshSessions: () => void
}

const empty = {
  sessions: {},
  prompts: {},
  conversations: {},
  screens: {},
  notice: null
}

export const useStore = create<State>((set, get) => ({
  client: null,
  connection: null,
  status: 'idle',
  detail: null,
  hostName: null,
  ...empty,

  attach: (client, connection) => set({ client, connection }),
  setStatus: (status, detail) => set({ status, detail: detail ?? null }),
  clearNotice: () => set({ notice: null }),
  reset: () => set({ ...empty, status: 'idle', detail: null, client: null, connection: null }),

  apply: (frame) =>
    set((state) => {
      switch (frame.type) {
        case 'challenge':
          return { hostName: frame.hostName }

        case 'ready':
          // Now it is worth remembering — a connection stored before this point
          // left the app believing it was paired when it was not.
          if (state.connection) void persist(state.connection.host, state.connection.port)
          return {
            hostName: state.hostName,
            sessions: Object.fromEntries(frame.sessions.map((s) => [s.tabId, s]))
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

  decide: (promptId, decision) => get().client?.send({ type: 'decide', promptId, decision }),
  submit: (tabId, text) => get().client?.send({ type: 'submit', tabId, text }),
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
