import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as Linking from 'expo-linking'
import 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'



function parseOAuthUrl(url: string | null): void {
  if (!url || !url.includes('#access_token')) return
  const hash = url.split('#')[1]
  if (!hash) return
  const params = new URLSearchParams(hash)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (access_token && refresh_token) {
    supabase.auth.setSession({ access_token, refresh_token })
  }
}

export default function RootLayout() {
  useEffect(() => {
    Linking.getInitialURL().then(parseOAuthUrl)
    const sub = Linking.addEventListener('url', ({ url }) => parseOAuthUrl(url))
    return () => sub.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#141414' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" options={{ animation: 'fade' }} />
        <Stack.Screen name="inspection" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  )
}
