import { useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { PromptCard } from '../../components/PromptCard'
import { WorkingRow } from '../../components/WorkingRow'
import { TurnRow } from '../../components/TurnRow'
import { useStore } from '../../lib/store'
import { feedItems } from '../../lib/turn-view'
import { activityColor, activityLabel, theme } from '../../lib/theme'

export default function Session(): React.JSX.Element {
  const { tabId } = useLocalSearchParams<{ tabId: string }>()
  const navigation = useNavigation()
  const scroller = useRef<ScrollView>(null)
  const [draft, setDraft] = useState('')
  const [showScreen, setShowScreen] = useState(false)

  const session = useStore((s) => (tabId ? s.sessions[tabId] : undefined))
  const conversation = useStore((s) => (tabId ? s.conversations[tabId] : undefined))
  const screen = useStore((s) => (tabId ? s.screens[tabId] : undefined))
  const prompts = useStore((s) => s.prompts)
  const notice = useStore((s) => s.notice)
  const status = useStore((s) => s.status)
  const detail = useStore((s) => s.detail)
  const live = status === 'ready'

  const { watch, unwatch, decide, submit, refreshScreen, clearNotice, client } = useStore()

  useEffect(() => {
    navigation.setOptions({ title: session?.folder ?? 'Session' })
  }, [navigation, session?.folder])

  // Follow this session while it is on screen, and tell the host so it can skip
  // a push for a question we are already looking at.
  useEffect(() => {
    if (!tabId) return
    watch(tabId)
    client?.reportForeground(true, tabId)
    return () => {
      unwatch()
      client?.reportForeground(true, null)
    }
  }, [tabId, watch, unwatch, client])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(clearNotice, 2600)
    return () => clearTimeout(timer)
  }, [notice, clearNotice])

  const waiting = Object.values(prompts).filter((p) => p.tabId === tabId)
  const turns = conversation?.turns ?? []

  const send = (): void => {
    const text = draft.trim()
    if (!text || !tabId) return
    submit(tabId, text)
    setDraft('')
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <View style={styles.bar}>
        {/* The session's own state is meaningless while the Mac is out of
            reach: everything on screen is then a snapshot of the past, and
            nothing typed here can go anywhere. Say which it is. */}
        <View
          style={[
            styles.dot,
            {
              backgroundColor:
                status === 'ready' ? activityColor(session?.activity ?? 'idle') : theme.bad
            }
          ]}
        />
        <Text style={[styles.barText, status !== 'ready' && styles.barOffline]}>
          {status === 'ready'
            ? `${activityLabel(session?.activity ?? 'idle')}${session?.branch ? `  ·  ${session.branch}` : ''}`
            : (detail ?? 'not connected to the Mac')}
        </Text>
        <Pressable
          onPress={() => {
            if (!tabId) return
            refreshScreen(tabId)
            setShowScreen(true)
          }}
        >
          <Text style={styles.barAction}>screen</Text>
        </Pressable>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <ScrollView
        ref={scroller}
        style={styles.feed}
        contentContainerStyle={styles.feedInner}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        {showScreen && screen ? (
          <View style={styles.screen}>
            <View style={styles.screenHead}>
              <Text style={styles.screenTitle}>terminal</Text>
              <Pressable onPress={() => setShowScreen(false)}>
                <Text style={styles.barAction}>hide</Text>
              </Pressable>
            </View>
            <ScrollView horizontal>
              <Text style={styles.screenText}>{screen.rows.join('\n')}</Text>
            </ScrollView>
          </View>
        ) : null}

        {conversation && conversation.before > 0 ? (
          <Text style={styles.earlier}>{conversation.before} earlier turns on the Mac</Text>
        ) : null}

        {turns.length === 0 ? (
          <Text style={styles.earlier}>Nothing said yet.</Text>
        ) : (
          feedItems(turns).map((item, i) => <TurnRow key={i} item={item} />)
        )}

        {session?.activity === 'busy' ? <WorkingRow session={session} /> : null}

        {waiting.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onDecide={(decision) => decide(prompt.id, decision)}
          />
        ))}
      </ScrollView>

      <View style={styles.composer}>
        {/* Dead while the Mac is unreachable: nothing typed here could go
            anywhere, and finding that out after writing a prompt is worse than
            being told up front. */}
        <TextInput
          style={[styles.input, !live && styles.inputOff]}
          value={draft}
          onChangeText={setDraft}
          placeholder={live ? 'Send a prompt…' : 'Not connected to the Mac'}
          placeholderTextColor={theme.faint}
          editable={live}
          multiline
        />
        <Pressable
          style={[styles.send, (!draft.trim() || !live) && styles.sendOff]}
          disabled={!draft.trim() || !live}
          onPress={send}
        >
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: theme.panel
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  barText: { color: theme.dim, fontSize: 12, flex: 1 },
  barOffline: { color: theme.bad },
  inputOff: { color: theme.faint, borderColor: theme.border, opacity: 0.6 },
  barAction: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  notice: {
    color: theme.bg,
    backgroundColor: theme.accent,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  feed: { flex: 1 },
  feedInner: { padding: 12, paddingBottom: 24 },
  earlier: { color: theme.faint, fontSize: 12, paddingVertical: 8 },
  screen: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  screenHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  screenTitle: { color: theme.faint, fontSize: 11, letterSpacing: 1 },
  screenText: { color: theme.dim, fontFamily: theme.mono, fontSize: 10, lineHeight: 14 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    backgroundColor: theme.panel
  },
  input: {
    flex: 1,
    color: theme.text,
    backgroundColor: theme.bg,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15
  },
  send: {
    backgroundColor: theme.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendOff: { backgroundColor: theme.border },
  sendText: { color: theme.bg, fontSize: 20, fontWeight: '700' }
})
