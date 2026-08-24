import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { saveConnection } from '../lib/secure-store'
import { useStore } from '../lib/store'
import { theme } from '../lib/theme'

/**
 * Pairing is typed in, because the host shows the code on a screen only its
 * owner can see — which is what makes the code proof of being there. There is no
 * QR to scan yet; when the host grows one, this screen gains a camera.
 */
export default function Pair(): React.JSX.Element {
  const router = useRouter()
  const client = useStore((s) => s.client)
  const status = useStore((s) => s.status)
  const detail = useStore((s) => s.detail)
  const attach = useStore((s) => s.attach)

  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [code, setCode] = useState('')

  const ready = host.trim().length > 0 && Number(port) > 0 && code.trim().length >= 6

  const pair = async (): Promise<void> => {
    if (!client || !ready) return
    const connection = { host: host.trim(), port: Number(port) }
    await saveConnection(connection.host, connection.port)
    attach(client, connection)
    client.pair(connection, code.trim())
  }

  return (
    <View style={styles.page}>
      <Text style={styles.help}>
        On the Mac: ⌘K → “Pair a phone…”. Both machines have to be on the same Tailscale network —
        nothing else can reach it.
      </Text>

      <Field label="Address" value={host} onChange={setHost} placeholder="100.87.175.39" keyboard="numbers-and-punctuation" />
      <Field label="Port" value={port} onChange={setPort} placeholder="50987" keyboard="number-pad" />
      <Field label="Code" value={code} onChange={setCode} placeholder="F96CFMS8" autoCaps />

      <Pressable
        style={[styles.button, !ready && styles.buttonOff]}
        disabled={!ready || status === 'pairing'}
        onPress={() => void pair()}
      >
        <Text style={styles.buttonText}>{status === 'pairing' ? 'Pairing…' : 'Pair'}</Text>
      </Pressable>

      {status === 'ready' ? (
        <Pressable style={styles.done} onPress={() => router.replace('/')}>
          <Text style={styles.doneText}>Paired — see your sessions</Text>
        </Pressable>
      ) : null}

      {status === 'error' && detail ? <Text style={styles.error}>{detail}</Text> : null}

      <Text style={styles.note}>
        The Mac will ask you to confirm this device before it is trusted. The code works once and
        expires after two minutes.
      </Text>
    </View>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
  autoCaps
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  keyboard?: 'number-pad' | 'numbers-and-punctuation'
  autoCaps?: boolean
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        keyboardType={keyboard}
        autoCapitalize={autoCaps ? 'characters' : 'none'}
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.bg, padding: 20, gap: 14 },
  help: { color: theme.dim, fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: theme.faint, fontSize: 12, letterSpacing: 0.5 },
  input: {
    color: theme.text,
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
    fontFamily: theme.mono
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6
  },
  buttonOff: { backgroundColor: theme.border },
  buttonText: { color: theme.bg, fontWeight: '700', fontSize: 15 },
  done: { backgroundColor: theme.good, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  doneText: { color: theme.bg, fontWeight: '700', fontSize: 15 },
  error: { color: theme.bad, fontSize: 13 },
  note: { color: theme.faint, fontSize: 12, lineHeight: 18, marginTop: 4 }
})
