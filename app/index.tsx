import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { key, label } from '../lib/hosts'
import { orderedHosts, sortedSessions, useStore } from '../lib/store'
import { doingSummary } from '../lib/doing'
import { activityColor, activityLabel, theme } from '../lib/theme'

/** One word for the header; the long version goes on its own line below. */
function shortStatus(status: string): string {
  if (status === 'ready') return 'connected'
  if (status === 'error') return 'not connected'
  return status
}

export default function Sessions(): React.JSX.Element {
  const router = useRouter()
  const status = useStore((s) => s.status)
  const detail = useStore((s) => s.detail)
  const hostName = useStore((s) => s.hostName)
  const connection = useStore((s) => s.connection)
  const book = useStore((s) => s.book)
  const sessions = useStore((s) => s.sessions)
  const prompts = useStore((s) => s.prompts)
  const refresh = useStore((s) => s.refreshSessions)
  const switchTo = useStore((s) => s.switchTo)

  const [picking, setPicking] = useState(false)

  const onRefresh = useCallback(() => refresh(), [refresh])
  const list = sortedSessions(sessions)
  const macs = orderedHosts(book)
  const waitingFor = (tabId: string): number =>
    Object.values(prompts).filter((p) => p.tabId === tabId).length

  // a working row counts its time; nothing ticks while every session is idle
  const [now, setNow] = useState(Date.now())
  const anyBusy = list.some((s) => s.activity === 'busy')
  useEffect(() => {
    if (!anyBusy) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [anyBusy])

  if (!connection?.host) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Not paired yet</Text>
        <Text style={styles.emptyBody}>
          On the Mac, open the command palette with ⌘K and choose “Pair a phone…”. It shows an
          address, a port and a code good for two minutes.
        </Text>
        <Pressable style={styles.cta} onPress={() => router.push('/pair')}>
          <Text style={styles.ctaText}>Enter a pairing code</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.page}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.dim} />}
    >
      {/* Every part of this row shrinks except the gear: a long "can't reach
          the Mac…" used to push Settings off the side of the screen, which is
          exactly when you most want to get at it. */}
      <View style={styles.header}>
        <Pressable
          style={styles.hostButton}
          disabled={macs.length < 2}
          onPress={() => setPicking(true)}
        >
          <Text style={styles.host} numberOfLines={1}>
            {hostName ?? connection.host}
          </Text>
          {macs.length > 1 ? <Text style={styles.chevron}>▾</Text> : null}
        </Pressable>
        <Text
          style={[styles.status, status === 'ready' && styles.statusOk]}
          numberOfLines={1}
        >
          {shortStatus(status)}
        </Text>
        <Link href="/settings" style={styles.settings}>
          ⚙
        </Link>
      </View>

      {status !== 'ready' && detail ? <Text style={styles.detail}>{detail}</Text> : null}

      {list.length === 0 ? (
        <Text style={styles.none}>
          {status === 'ready' ? 'No sessions open on the Mac.' : 'Waiting for the Mac…'}
        </Text>
      ) : null}

      {list.map((session) => {
        const waiting = waitingFor(session.tabId)
        return (
          <Pressable
            key={session.tabId}
            style={styles.row}
            onPress={() => router.push(`/session/${session.tabId}`)}
          >
            <View style={[styles.dot, { backgroundColor: activityColor(session.activity) }]} />
            <View style={styles.rowBody}>
              <Text style={styles.folder}>{session.folder}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {session.activity === 'busy'
                  ? doingSummary(session, now)
                  : activityLabel(session.activity)}
                {session.branch ? `  ·  ${session.branch}` : ''}
                {session.model ? `  ·  ${session.model}` : ''}
              </Text>
            </View>
            {waiting > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{waiting}</Text>
              </View>
            ) : null}
          </Pressable>
        )
      })}

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.scrim} onPress={() => setPicking(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Macs</Text>
            {macs.map((mac) => {
              const live = key(mac) === book.active
              return (
                <Pressable
                  key={key(mac)}
                  style={styles.pick}
                  onPress={() => {
                    setPicking(false)
                    switchTo(key(mac))
                  }}
                >
                  <Text style={[styles.pickMark, live && styles.pickMarkOn]}>{live ? '✓' : ''}</Text>
                  <View style={styles.rowBody}>
                    <Text style={styles.folder}>{label(mac)}</Text>
                    <Text style={styles.meta}>{key(mac)}</Text>
                  </View>
                </Pressable>
              )
            })}
            <Pressable
              style={styles.pick}
              onPress={() => {
                setPicking(false)
                router.push('/pair')
              }}
            >
              <Text style={styles.pickMark}>+</Text>
              <Text style={styles.pickAdd}>Pair another Mac…</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  hostButton: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  host: { color: theme.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  chevron: { color: theme.dim, fontSize: 12 },
  status: { color: theme.warn, fontSize: 12, flexShrink: 1, marginLeft: 'auto' },
  statusOk: { color: theme.good },
  settings: { color: theme.dim, fontSize: 18, flexGrow: 0, flexShrink: 0 },
  detail: { color: theme.warn, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 10 },
  none: { color: theme.faint, fontSize: 14, padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.panel,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 8
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowBody: { flex: 1 },
  folder: { color: theme.text, fontSize: 16, fontWeight: '600' },
  meta: { color: theme.dim, fontSize: 12, marginTop: 2 },
  badge: {
    backgroundColor: theme.warn,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: { color: theme.bg, fontWeight: '700', fontSize: 12 },
  scrim: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.panel, padding: 12, paddingBottom: 34, gap: 4 },
  sheetTitle: { color: theme.faint, fontSize: 11, letterSpacing: 1, paddingHorizontal: 6 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 6 },
  pickMark: { color: theme.faint, fontSize: 15, width: 16, textAlign: 'center' },
  pickMarkOn: { color: theme.good },
  pickAdd: { color: theme.accent, fontSize: 16, fontWeight: '600' },
  empty: { flex: 1, backgroundColor: theme.bg, padding: 24, gap: 12, justifyContent: 'center' },
  emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: theme.dim, fontSize: 14, lineHeight: 21 },
  cta: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8
  },
  ctaText: { color: theme.bg, fontWeight: '700', fontSize: 15 }
})
