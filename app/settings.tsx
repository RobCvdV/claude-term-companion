import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { key, label, type SavedHost } from '../lib/hosts'
import { orderedHosts, useStore } from '../lib/store'
import { theme } from '../lib/theme'

export default function Settings(): React.JSX.Element {
  const router = useRouter()
  const book = useStore((s) => s.book)
  const hostName = useStore((s) => s.hostName)
  const status = useStore((s) => s.status)
  const switchTo = useStore((s) => s.switchTo)
  const forgetHost = useStore((s) => s.forgetHost)

  const macs = orderedHosts(book)
  const last = macs.length === 1

  const forget = (mac: SavedHost): void => {
    Alert.alert(
      `Forget ${label(mac)}?`,
      last
        ? 'You will need a new pairing code to connect again.'
        : 'You will need a new pairing code from that Mac to connect to it again. The other Macs are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: () => {
            // The device key stays: one key enrols with every Mac, so dropping
            // it here would lock this phone out of the ones it is keeping.
            // Trust lives on the Mac anyway, and only "Paired phones…" ends it.
            forgetHost(key(mac))
            router.replace('/')
          }
        }
      ]
    )
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.inner}>
      <Text style={styles.heading}>Macs</Text>

      {macs.length === 0 ? <Text style={styles.note}>No Macs paired yet.</Text> : null}

      {macs.map((mac) => {
        const live = key(mac) === book.active
        return (
          <View key={key(mac)} style={[styles.mac, live && styles.macLive]}>
            <Pressable style={styles.macBody} onPress={() => switchTo(key(mac))}>
              <Text style={styles.macName} numberOfLines={1}>
                {live ? '✓  ' : ''}
                {live ? (hostName ?? label(mac)) : label(mac)}
              </Text>
              <Text style={styles.macAddress} numberOfLines={1}>
                {key(mac)}
                {live ? `  ·  ${status}` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={() => forget(mac)} hitSlop={8}>
              <Text style={styles.forget}>Forget</Text>
            </Pressable>
          </View>
        )
      })}

      <Pressable style={styles.add} onPress={() => router.push('/pair')}>
        <Text style={styles.addText}>Pair another Mac…</Text>
      </Pressable>

      <Text style={styles.note}>
        Tap a Mac to talk to it — one at a time. Every paired Mac can still send this phone a push
        when one of its sessions wants you.
      </Text>

      <Text style={styles.note}>
        Reachable only over Tailscale. Nothing is stored on a server: this phone holds a private key
        and proves it holds it each time it connects.
      </Text>

      <Text style={styles.note}>
        Forgetting leaves an unused entry under “Paired phones…” on that Mac. Revoke it there too.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg },
  inner: { padding: 20, gap: 10, paddingBottom: 40 },
  heading: { color: theme.faint, fontSize: 11, letterSpacing: 1 },
  mac: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.panel,
    borderColor: theme.panel,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14
  },
  macLive: { borderColor: theme.border },
  macBody: { flex: 1, flexShrink: 1 },
  macName: { color: theme.text, fontSize: 15, fontWeight: '600' },
  macAddress: { color: theme.dim, fontSize: 12, fontFamily: theme.mono, marginTop: 3 },
  forget: { color: theme.bad, fontSize: 13, fontWeight: '600' },
  add: {
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center'
  },
  addText: { color: theme.accent, fontWeight: '700', fontSize: 15 },
  note: { color: theme.faint, fontSize: 12, lineHeight: 18 }
})
