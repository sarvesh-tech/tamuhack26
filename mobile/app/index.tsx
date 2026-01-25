import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk'
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { getFlights, type Flight } from '@/lib/flightEngine'
import { INSPECTION_STEPS } from '@/constants/inspectionSteps'

const PRE_HEADLINE = 'REAL-TIME INSPECTION VERIFICATION FOR FLIGHT OPERATIONS.'

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function SignedInScreen({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const router = useRouter()
  const [userFlightNumber, setUserFlightNumber] = useState<string | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [flightLoading, setFlightLoading] = useState(true)
  const [flightError, setFlightError] = useState<string | null>(null)
  const [startInspectionLoading, setStartInspectionLoading] = useState(false)
  const [startInspectionError, setStartInspectionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: row } = await supabase
        .from('user_flights')
        .select('flight_number')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      const fn = row?.flight_number ?? null
      setUserFlightNumber(fn)
      if (!fn) {
        setFlightLoading(false)
        return
      }
      setFlightError(null)
      try {
        let list = await getFlights(undefined, fn)
        if (list.length === 0 && fn.startsWith('AA')) {
          list = await getFlights(undefined, fn.slice(2))
        }
        if (!cancelled) setFlight(list[0] ?? null)
      } catch (e) {
        if (!cancelled) setFlightError(e instanceof Error ? e.message : 'Failed to load flight')
      } finally {
        if (!cancelled) setFlightLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.signedInScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.signedIn}>
          <Image
            source={require('@/assets/images/TextLogo.png')}
            style={styles.logoSmall}
            resizeMode="contain"
          />
          <Text style={styles.signedInTitle}>You’re signed in</Text>
          <Text style={styles.signedInEmail} numberOfLines={1}>
            {email}
          </Text>

          {flightLoading && (
            <View style={styles.flightCard}>
              <ActivityIndicator size="small" color="#a1a1aa" />
              <Text style={styles.flightCardLoading}>Loading flight…</Text>
            </View>
          )}

          {!flightLoading && flight && (
            <View style={styles.flightCard}>
              <Text style={styles.flightCardTitle}>AA{flight.flightNumber}</Text>
              <Text style={styles.flightCardRoute}>
                {flight.origin.code} → {flight.destination.code}
              </Text>
              <Text style={styles.flightCardCities}>
                {flight.origin.city} to {flight.destination.city}
              </Text>
              <View style={styles.flightCardRow}>
                <Text style={styles.flightCardLabel}>Departure</Text>
                <Text style={styles.flightCardValue}>{formatDateTime(flight.departureTime)}</Text>
              </View>
              <View style={styles.flightCardRow}>
                <Text style={styles.flightCardLabel}>Arrival</Text>
                <Text style={styles.flightCardValue}>{formatDateTime(flight.arrivalTime)}</Text>
              </View>
              <View style={styles.flightCardRow}>
                <Text style={styles.flightCardLabel}>Aircraft</Text>
                <Text style={styles.flightCardValue}>{flight.aircraft.model}</Text>
              </View>
              <View style={styles.flightCardRow}>
                <Text style={styles.flightCardLabel}>Duration</Text>
                <Text style={styles.flightCardValue}>{flight.duration.locale}</Text>
              </View>
            </View>
          )}

          {!flightLoading && userFlightNumber && !flight && !flightError && (
            <View style={styles.flightCard}>
              <Text style={styles.flightCardTitle}>{userFlightNumber}</Text>
              <Text style={styles.flightCardMuted}>Details unavailable for this date</Text>
            </View>
          )}

          {!flightLoading && flightError && (
            <View style={styles.flightCard}>
              <Text style={styles.flightCardMuted}>{flightError}</Text>
            </View>
          )}

          {!flightLoading && !userFlightNumber && (
            <View style={styles.flightCard}>
              <Text style={styles.flightCardMuted}>No flight selected. Choose one on the web app.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.startInspectionBtn, startInspectionLoading && styles.startInspectionBtnDisabled]}
            onPress={async () => {
              setStartInspectionError(null)
              setStartInspectionLoading(true)
              try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) throw new Error('Not signed in')
                const { data: sessionRow, error: sessionErr } = await supabase
                  .from('inspection_sessions')
                  .insert({
                    inspector_id: user.id,
                    inspector_email: user.email ?? null,
                    inspector_name: (user.user_metadata?.full_name ?? user.user_metadata?.name) ?? null,
                    flight_number: userFlightNumber ?? null,
                  })
                  .select('id')
                  .single()
                if (sessionErr || !sessionRow) throw sessionErr || new Error('Failed to create session')
                const { error: stepsErr } = await supabase
                  .from('inspection_step_instances')
                  .insert(INSPECTION_STEPS.map((s) => ({ session_id: sessionRow.id, step_id: s.id, title: s.title, status: 'pending' })))
                if (stepsErr) throw stepsErr
                router.replace({ pathname: '/inspection/guided', params: { sessionId: sessionRow.id } })
              } catch (e) {
                setStartInspectionError(e instanceof Error ? e.message : 'Failed to start inspection')
              } finally {
                setStartInspectionLoading(false)
              }
            }}
            disabled={startInspectionLoading}
          >
            {startInspectionLoading ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <Text style={styles.startInspectionBtnText}>Start Inspection</Text>
            )}
          </TouchableOpacity>
          {startInspectionError && (
            <Text style={styles.startInspectionError}>{startInspectionError}</Text>
          )}

          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

export default function AuthScreen() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    console.log('redirectTo:', Linking.createURL('auth/callback'))
  }, [])

  async function signInWithGoogle() {
    setLoading(true)
    setMessage(null)
    const redirectUrl = Linking.createURL('auth/callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }
    if (data?.url) {
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
      if (res.type === 'success' && res.url) {
        const hash = res.url.split('#')[1]
        if (hash) {
          const params = new URLSearchParams(hash)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
          }
        }
      }
    }
    setLoading(false)
  }

  async function signInWithEmail() {
    if (!email.trim()) return
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }
    setMessage({ type: 'success', text: 'Check your email for the login link.' })
    setEmail('')
    setLoading(false)
  }

  function signOut() {
    supabase.auth.signOut()
    setMessage(null)
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#a1a1aa" />
      </View>
    )
  }

  if (session?.user) {
    return (
      <SignedInScreen
        email={session.user.email ?? ''}
        onSignOut={signOut}
      />
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.pre}>{PRE_HEADLINE}</Text>
          <Image
            source={require('@/assets/images/TextLogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={signInWithGoogle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <>
                <GoogleIcon />
                <Text style={styles.btnPrimaryText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#71717a"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={signInWithEmail}
            disabled={loading}
          >
            <Text style={styles.btnSecondaryText}>Email me a link</Text>
          </TouchableOpacity>
          {message && (
            <View style={[styles.msg, message.type === 'success' ? styles.msgSuccess : styles.msgError]}>
              <Text style={[styles.msgText, message.type === 'success' ? styles.msgSuccessText : styles.msgErrorText]}>
                {message.text}
              </Text>
            </View>
          )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
  },
  pre: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    letterSpacing: 1.2,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 100,
    marginBottom: 10,
    lineHeight: 20,
  },
  logo: {
    width: 260,
    maxHeight: 172,
    alignSelf: 'center',
    marginBottom: 10,
  },
  card: {
    alignSelf: 'stretch',
    marginTop: 0,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 20,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: '#fafafa',
    marginBottom: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnPrimary: {
    backgroundColor: '#fafafa',
    marginBottom: 14,
  },
  btnPrimaryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#0a0a0a',
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnSecondaryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#fafafa',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#52525b',
  },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#fafafa',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  msg: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  msgSuccess: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  msgError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  msgText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  msgSuccessText: { color: '#86efac' },
  msgErrorText: { color: '#fca5a5' },
  signedInScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  signedIn: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  logoSmall: {
    width: 180,
    height: 80,
    marginBottom: 24,
  },
  signedInTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 20,
    color: '#fafafa',
    marginBottom: 8,
  },
  signedInEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#a1a1aa',
    marginBottom: 20,
  },
  flightCard: {
    alignSelf: 'stretch',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  flightCardTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: '#fafafa',
    marginBottom: 8,
  },
  flightCardRoute: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#e4e4e7',
    marginBottom: 4,
  },
  flightCardCities: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#a1a1aa',
    marginBottom: 14,
  },
  flightCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flightCardLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#71717a',
  },
  flightCardValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#e4e4e7',
  },
  flightCardLoading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 8,
  },
  flightCardMuted: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#a1a1aa',
  },
  startInspectionBtn: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  startInspectionBtnDisabled: {
    opacity: 0.7,
  },
  startInspectionBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: '#0a0a0a',
  },
  startInspectionError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#fca5a5',
    marginBottom: 12,
    textAlign: 'center',
  },
  signOutBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
  },
  signOutBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#fafafa',
  },
})
