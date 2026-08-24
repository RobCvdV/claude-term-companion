import { useCallback } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { sortedSessions, useStore } from '../lib/store'
import { activityColor, activityLabel, theme } from '../lib/theme'

export default function Sessions(): React.JSX.Element {
  const router = useRouter()
  const status = useStore((s) => s.status)
  const detail = useStore((s) => s.detail)
  const hostName = useStore((s) => s.hostName)
  const connection = useStore((s) => s.connection)
  const sessions = useStore((s) => s.sessions)
  const prompts = useStore((s) => s.prompts)
  const refresh = useStore((s) => s.refreshSessions)

  const onRefresh = useCallback(() => refresh(), [refresh])
  const list = sortedSessions(sessions)
  const waitingFor = (tabId: string): number =>
    Object.values(prompts).filter((p) => p.tabId === tabId).length

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
      <View style={styles.header}>
        <Text style={styles.host}>{hostName ?? connection.host}</Text>
        <View style={styles.headerRight}>
          <Text style={[styles.status, status === 'ready' && styles.statusOk]}>
            {status === 'ready' ? 'connected' : (detail ?? status)}
          </Text>
          <Link href="/settings" style={styles.settings}>
            ⚙
          </Link>
        </View>
      </View>

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
              <Text style={styles.meta}>
                {activityLabel(session.activity)}
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  host: { color: theme.text, fontSize: 15, fontWeight: '600' },
  status: { color: theme.warn, fontSize: 12 },
  statusOk: { color: theme.good },
  settings: { color: theme.dim, fontSize: 18 },
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
