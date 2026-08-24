import { useEffect } from 'react'
import { AppState } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { CompanionClient } from '../lib/client'
import { loadIdentity } from '../lib/identity'
import { keychain, loadConnection, randomBytes } from '../lib/secure-store'
import { useStore } from '../lib/store'
import { theme } from '../lib/theme'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
})

/** The host only pushes to a device that gave it a token, so this is opt-in. */
async function pushToken(): Promise<string | null> {
  if (!Device.isDevice) return null
  const existing = await Notifications.getPermissionsAsync()
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted
  if (!granted) return null
  try {
    return (await Notifications.getExpoPushTokenAsync()).data
  } catch {
    // no EAS project configured yet; everything else still works
    return null
  }
}

export default function Layout(): React.JSX.Element {
  const attach = useStore((s) => s.attach)
  const setStatus = useStore((s) => s.setStatus)
  const apply = useStore((s) => s.apply)

  useEffect(() => {
    let client: CompanionClient | null = null
    let token: string | null = null

    void (async () => {
      const identity = await loadIdentity(keychain, randomBytes)
      token = await pushToken()
      client = new CompanionClient(
        identity,
        { onStatus: setStatus, onFrame: apply },
        undefined,
        Device.deviceName ?? 'phone',
        () => token
      )
      const connection = await loadConnection()
      attach(client, connection ?? { host: '', port: 0 })
      if (connection?.host) client.connect(connection)
    })()

    // The host skips a push for a session this device is looking at, so it has
    // to know when we stop looking.
    const subscription = AppState.addEventListener('change', (state) => {
      client?.reportForeground(state === 'active', null)
    })
    return () => {
      subscription.remove()
      client?.disconnect()
    }
  }, [attach, setStatus, apply])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.panel },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.bg }
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Sessions' }} />
        <Stack.Screen name="pair" options={{ title: 'Pair with a Mac' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="session/[tabId]" options={{ title: 'Session' }} />
      </Stack>
    </>
  )
}
