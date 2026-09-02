import { useEffect, useState } from 'react'
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
import { useRouter } from 'expo-router'
import { parsePairingPayload } from '../lib/pairing-payload'
import { useStore } from '../lib/store'
import { theme } from '../lib/theme'

/**
 * The scanner is optional. expo-camera throws at import time when its native
 * side is missing from the running build — which used to take the whole route
 * tree down, on a screen the user had not even opened. Typing the code works
 * either way, so a missing camera is a smaller screen, not a crash.
 */
let QrScanner: ((props: { onScan: (data: string) => void }) => React.JSX.Element) | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  QrScanner = (require('../components/QrScanner') as typeof import('../components/QrScanner'))
    .QrScanner
} catch {
  QrScanner = null
}

/**
 * Scan the code the Mac is showing, or type it.
 *
 * The QR carries the address and port as well, which is the whole point: an IP,
 * a port and a code is a lot to retype every time a phone forgets a network.
 */
export default function Pair(): React.JSX.Element {
  const router = useRouter()
  const client = useStore((s) => s.client)
  const status = useStore((s) => s.status)
  const detail = useStore((s) => s.detail)
  const attach = useStore((s) => s.attach)
  const lastHost = useStore((s) => s.connection?.host ?? '')
  const lastPort = useStore((s) => s.connection?.port)

  const [scanning, setScanning] = useState(true)
  // Prefilled from wherever this phone last connected, so a re-pair is just the code.
  const [host, setHost] = useState(lastHost)
  const [port, setPort] = useState(lastPort ? String(lastPort) : '')
  const [code, setCode] = useState('')

  useEffect(() => {
    if (status === 'ready') router.replace('/')
  }, [status, router])

  // A scan that failed leaves nothing to try again with: the camera is put away
  // the moment it reads a code, so a spent or lapsed one used to strand the
  // screen. Bring it back so the next code on the Mac can just be scanned.
  useEffect(() => {
    if (status === 'error') setScanning(true)
  }, [status])

  // The stored connection is loaded asynchronously (see _layout), so it can
  // arrive after this screen has already mounted — useState would have missed
  // it and left Address blank with the button dead and nothing said about why.
  useEffect(() => {
    if (lastHost) setHost((current) => current || lastHost)
    if (lastPort) setPort((current) => current || String(lastPort))
  }, [lastHost, lastPort])

  const missing = [
    host.trim() ? null : 'address',
    Number(port) > 0 ? null : 'port',
    code.trim().length >= 6 ? null : 'code'
  ].filter(Boolean)
  const ready = missing.length === 0

  const pair = (nextHost: string, nextPort: number, nextCode: string): void => {
    if (!client) return
    const connection = { host: nextHost, port: nextPort }
    // Saved only once the host accepts us — a stored connection makes the app
    // think it is paired, and a failed attempt used to leave it stuck there.
    attach(client, connection)
    client.pair(connection, nextCode)
  }

  const onScan = (raw: string): void => {
    const payload = parsePairingPayload(raw)
    if (!payload) return
    setScanning(false)
    setHost(payload.host)
    setPort(String(payload.port))
    setCode(payload.code)
    pair(payload.host, payload.port, payload.code)
  }

  return (
    // The keyboard used to cover the fields with no way to reach them: the
    // scanner alone is 220pt, and on a small phone the code field sits exactly
    // where the keyboard comes up. Same pattern as the session screen, plus a
    // scroll so every field stays reachable while it is open.
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {QrScanner && scanning ? <QrScanner onScan={onScan} /> : null}

        <Text style={styles.help}>
          On the Mac: ⌘K → “Phones — pair or revoke…”. Both machines have to be on the same
          Tailscale network; nothing else can reach it.
        </Text>

        <Field label="Address" value={host} onChange={setHost} placeholder="100.87.175.39" keyboard="numbers-and-punctuation" />
        <Field label="Port" value={port} onChange={setPort} placeholder="50987" keyboard="number-pad" />
        <Field label="Code" value={code} onChange={setCode} placeholder="F96CFMS8" autoCaps />

        <Pressable
          style={[styles.button, !ready && styles.buttonOff]}
          disabled={!ready || status === 'pairing'}
          onPress={() => pair(host.trim(), Number(port), code.trim())}
        >
          <Text style={styles.buttonText}>{status === 'pairing' ? 'Pairing…' : 'Pair'}</Text>
        </Pressable>

        {status === 'error' && detail ? <Text style={styles.error}>{detail}</Text> : null}

        {!ready ? (
          <Text style={styles.note}>
            Still needed: {missing.join(', ')} — scan the code on the Mac to fill all three.
          </Text>
        ) : null}

        <Text style={styles.note}>
          The code works once and expires after two minutes. If it fails, show a new one on the Mac.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
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
  page: { flex: 1, backgroundColor: theme.bg },
  inner: { padding: 20, gap: 12, paddingBottom: 40 },
  help: { color: theme.dim, fontSize: 13, lineHeight: 19 },
  field: { gap: 5 },
  label: { color: theme.faint, fontSize: 12, letterSpacing: 0.5 },
  input: {
    color: theme.text,
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontFamily: theme.mono
  },
  button: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  buttonOff: { backgroundColor: theme.border },
  buttonText: { color: theme.bg, fontWeight: '700', fontSize: 15 },
  error: { color: theme.bad, fontSize: 13 },
  note: { color: theme.faint, fontSize: 12, lineHeight: 18 }
})
