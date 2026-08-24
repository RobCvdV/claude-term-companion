import { StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Pressable } from 'react-native'
import { theme } from '../lib/theme'

/**
 * Isolated in its own module on purpose: expo-camera throws at import time when
 * its native side is not in the running build, so it must be requireable
 * separately and allowed to fail. Everything else on the pairing screen works
 * without it.
 */
export function QrScanner({ onScan }: { onScan: (data: string) => void }): React.JSX.Element {
  const [permission, requestPermission] = useCameraPermissions()

  if (!permission) {
    return <Text style={styles.hint}>Checking the camera…</Text>
  }
  if (!permission.granted) {
    return (
      <Pressable style={styles.ask} onPress={() => void requestPermission()}>
        <Text style={styles.askText}>Allow the camera to scan the code</Text>
      </Pressable>
    )
  }
  return (
    <View style={styles.box}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
      <Text style={styles.hint}>Point at the code on the Mac</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.panel },
  camera: { flex: 1 },
  hint: {
    color: theme.dim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 6,
    backgroundColor: theme.panel
  },
  ask: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  askText: { color: theme.dim, fontSize: 13, fontWeight: '600' }
})
