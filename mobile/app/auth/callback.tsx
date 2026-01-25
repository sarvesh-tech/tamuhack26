import { useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackScreen() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const url = await Linking.getInitialURL()
      if (url && url.includes('#access_token')) {
        const hash = url.split('#')[1]
        if (hash) {
          const params = new URLSearchParams(hash)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
          }
        }
      }
      router.replace('/')
    }
    run()
  }, [router])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#a1a1aa" />
      <Text style={styles.text}>Completing sign in…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 15,
    color: '#a1a1aa',
  },
})
