import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { resetIdentity } from '../lib/identity'
import { forgetConnection, keychain } from '../lib/secure-store'
import { useStore } from '../lib/store'
import { theme } from '../lib/theme'

export default function Settings(): React.JSX.Element {
  const router = useRouter()
  const connection = useStore((s) => s.connection)
  const hostName = useStore((s) => s.hostName)
  const status = useStore((s) => s.status)
  const client = useStore((s) => s.client)
  const reset = useStore((s) => s.reset)

  const unpair = (): void => {
    Alert.alert('Forget this Mac?', 'You will need a new pairing code to connect again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            client?.disconnect()
            await forgetConnection()
            // a new key means the old entry on the Mac is dead weight — revoke it there
            await resetIdentity(keychain)
            reset()
            router.replace('/')
          })()
        }
      }
    ])
  }

  return (
    <View style={styles.page}>
      <Row label="Mac" value={hostName ?? '—'} />
      <Row label="Address" value={connection?.host ? `${connection.host}:${connection.port}` : '—'} />
      <Row label="Connection" value={status} />

      <Text style={styles.note}>
        Reachable only over Tailscale. Nothing is stored on a server: this phone holds a private key
        and proves it holds it each time it connects.
      </Text>

      <Pressable style={styles.danger} onPress={unpair}>
        <Text style={styles.dangerText}>Forget this Mac</Text>
      </Pressable>
      <Text style={styles.note}>
        Forgetting leaves an unused entry under “Paired phones…” on the Mac. Revoke it there too.
      </Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg, padding: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.panel,
    borderRadius: 10,
    padding: 14
  },
  label: { color: theme.dim, fontSize: 14 },
  value: { color: theme.text, fontSize: 14, fontFamily: theme.mono },
  note: { color: theme.faint, fontSize: 12, lineHeight: 18 },
  danger: {
    borderColor: theme.bad,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10
  },
  dangerText: { color: theme.bad, fontWeight: '700', fontSize: 15 }
})
