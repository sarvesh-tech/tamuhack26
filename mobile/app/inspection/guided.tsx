import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useInspectionSession } from '@/hooks/useInspectionSession'
import { INSPECTION_STEPS } from '@/constants/inspectionSteps'
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter'
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk'

export default function GuidedInspectionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session, steps, loading, error } = useInspectionSession(sessionId ?? null)

  const total = session?.total_steps ?? 12
  const completed = session?.steps_completed ?? 0
  const pct = session?.progress_pct ?? 0

  function getStatus(stepId: number): 'pending' | 'in_progress' | 'completed' {
    const s = steps.find((x) => x.step_id === stepId)
    return (s?.status ?? 'pending') as 'pending' | 'in_progress' | 'completed'
  }

  function openStep(stepId: number) {
    if (getStatus(stepId) === 'completed') return
    router.push({ pathname: '/inspection/step', params: { sessionId: sessionId ?? '', stepId: String(stepId) } })
  }

  if (loading && !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#a1a1aa" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    )
  }

  if (error || !sessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Missing sessionId'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, { paddingTop: (insets.top || 24) + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Preflight Checklist</Text>
        <Text style={styles.progressLabel}>
          {completed}/{total} steps · {pct}%
        </Text>
      </View>

      <View style={styles.barWrap}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.list}>
        {INSPECTION_STEPS.map((step) => {
          const status = getStatus(step.id)
          const isDone = status === 'completed'
          return (
            <TouchableOpacity
              key={step.id}
              style={[styles.item, isDone && styles.itemDone]}
              onPress={() => openStep(step.id)}
              disabled={isDone}
            >
              <Text style={styles.itemNum}>{step.id}</Text>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{step.title}</Text>
                <Text style={[styles.itemStatus, status === 'completed' && styles.itemStatusDone, status === 'in_progress' && styles.itemStatusActive]}>
                  {status.replace('_', ' ')}
                </Text>
              </View>
              {!isDone && <Text style={styles.itemArrow}>›</Text>}
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#141414', padding: 24 },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#a1a1aa', marginTop: 12 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#fca5a5', textAlign: 'center' },
  backBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 },
  backBtnText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#fafafa' },
  scroll: { flex: 1, backgroundColor: '#141414' },
  container: { padding: 24, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 20, color: '#fafafa', marginBottom: 4 },
  progressLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#a1a1aa' },
  barWrap: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 },
  barFill: { height: '100%', backgroundColor: '#60a5fa', borderRadius: 4 },
  list: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12 },
  itemDone: { opacity: 0.85 },
  itemNum: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#71717a', width: 24, marginRight: 12 },
  itemBody: { flex: 1 },
  itemTitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#e4e4e7', marginBottom: 4 },
  itemStatus: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#a1a1aa', textTransform: 'uppercase' },
  itemStatusDone: { color: '#86efac' },
  itemStatusActive: { color: '#60a5fa' },
  itemArrow: { fontFamily: 'Inter_400Regular', fontSize: 18, color: '#71717a', marginLeft: 8 },
})
