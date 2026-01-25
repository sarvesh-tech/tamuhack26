import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Audio } from 'expo-av'
import { supabase } from '@/lib/supabase'
import { INSPECTION_STEPS } from '@/constants/inspectionSteps'
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter'
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL

export default function StepCaptureScreen() {
  const { sessionId, stepId } = useLocalSearchParams<{ sessionId: string; stepId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const stepNum = stepId ? parseInt(stepId, 10) : 0
  const step = INSPECTION_STEPS.find((s) => s.id === stepNum)

  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [sttLoading, setSttLoading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [startDone, setStartDone] = useState(false)

  useEffect(() => {
    if (!sessionId || !stepId) return
    let done = false
    supabase
      .rpc('rpc_start_step', {
        p_session_id: sessionId,
        p_step_id: stepNum,
        p_started_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (!done && error) console.warn('rpc_start_step:', error.message)
        if (!done) setStartDone(true)
      })
    return () => { done = true }
  }, [sessionId, stepId, stepNum])

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required for inspection photos.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri)
    }
  }

  async function startRecording() {
    const { status } = await Audio.requestPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Microphone access is required for voice notes.')
      return
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    })
    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )
    setRecording(rec)
  }

  async function stopRecording() {
    if (!recording) return
    await recording.stopAndUnloadAsync()
    const uri = recording.getURI()
    setRecording(null)
    if (!uri) return
    setSttLoading(true)
    setTranscript(null)
    try {
      const form = new FormData()
      form.append('audio', { uri, type: 'audio/m4a', name: 'audio.m4a' } as any)
      const { data: { session: s } } = await supabase.auth.getSession()
      const r = await fetch(`${supabaseUrl}/functions/v1/speech-to-text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${s?.access_token}` },
        body: form,
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || json.details || 'STT failed')
      setTranscript(json.transcript || '')
    } catch (e) {
      setTranscript('')
      Alert.alert('Speech-to-text failed', e instanceof Error ? e.message : 'Could not transcribe. You can complete with an empty note.')
    } finally {
      setSttLoading(false)
    }
  }

  async function complete() {
    if (!sessionId || !stepId || !photoUri) {
      Alert.alert('Missing photo', 'Please take a photo before completing.')
      return
    }
    setCompleting(true)
    try {
      const path = `sessions/${sessionId}/steps/${stepId}/${Date.now()}.jpg`

      const formData = new FormData()
      formData.append('file', {
        uri: photoUri,
        name: path.split('/').pop(),
        type: 'image/jpeg',
      } as any)

      const { error: upErr } = await supabase.storage
        .from('inspection-evidence')
        .upload(path, formData)

      if (upErr) throw upErr

      let ai_severity = 'none'
      let ai_analysis = null

      console.log('[Mobile] ===== AI ANALYSIS START =====')
      console.log('[Mobile] Step title:', step?.title)
      console.log('[Mobile] Transcript:', transcript)
      
      try {
        console.log('[Mobile] Calling OpenAI directly...')
        
        const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY
        
        if (!OPENAI_API_KEY) {
          console.warn('[Mobile] OPENAI_API_KEY not configured, skipping AI analysis')
        } else {
          const prompt = `You are an airline safety inspector. Analyze the following preflight inspection task and the inspector's notes.
Deduce the severity level of any issues found. BE VERY SENSITIVE to any language suggesting problems, even if mixed with positive statements.

TASK: "${step?.title}"
NOTES: "${transcript || "No notes provided"}"

Respond in strict JSON format with two fields:
- "severity": one of ["low", "medium", "high", "none"]
  - "high": ANY mention of death, danger, missing equipment, broken items, failure, critical problems, sarcasm about safety, or anything that suggests the flight should not depart. Examples: "people are going to die", "extinguisher missing", "door won't seal", "hydraulic leak".
  - "medium": Concerns, hesitations, incomplete checks, unprofessional notes, or anything suspicious. Examples: "not sure", "might be an issue", "hello" as a note (inappropriate), "I guess it's fine".
  - "low": Minor observations, trivial notes, or routine findings with no safety concern.
  - "none": ONLY use if the notes explicitly confirm everything is correct with positive language like "checked", "verified", "good", "all clear", "operational", "armed correctly".
- "analysis": A brief, one-sentence professional summary. If there's a problem, describe it clearly.

IMPORTANT: If ANY part of the notes suggests a problem or concern, classify it as at least "medium". Do NOT default to "none" or "low" when there are red flags.`

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0,
              response_format: { type: 'json_object' }
            })
          })
          
          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
          }
          
          const data = await response.json()
          console.log('[Mobile] OpenAI response:', data)
          
          const result = JSON.parse(data.choices[0].message.content)
          ai_severity = result.severity || 'none'
          ai_analysis = result.analysis || null
          console.log('[Mobile] Parsed AI result:', { severity: ai_severity, analysis: ai_analysis })
        }
      } catch (e) {
        console.error('[Mobile] AI analysis exception:', e)
      }
      
      console.log('[Mobile] Final AI values being saved:', { ai_severity, ai_analysis })
      console.log('[Mobile] ===== AI ANALYSIS END =====')

      const { error: rpcErr } = await supabase.rpc('rpc_complete_step', {
        p_session_id: sessionId,
        p_step_id: stepNum,
        p_photo_path: path,
        p_transcript: transcript ?? '',
        p_completed_at: new Date().toISOString(),
        p_ai_severity: ai_severity,
        p_ai_analysis: ai_analysis,
      })
      if (rpcErr) throw rpcErr

      router.replace({ pathname: '/inspection/guided', params: { sessionId } })
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to complete step.')
    } finally {
      setCompleting(false)
    }
  }

  if (!step) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Invalid step</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: (insets.top || 24) + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>Step {step.id}</Text>
        <Text style={styles.title}>{step.title}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Photo</Text>
        {photoUri ? (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: photoUri }} style={styles.thumb} />
            <Text style={styles.doneLabel}>✓ Taken</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={takePhoto}>
            <Text style={styles.btnText}>Take photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Voice note</Text>
        {recording ? (
          <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={stopRecording}>
            <Text style={styles.btnText}>Stop recording</Text>
          </TouchableOpacity>
        ) : sttLoading ? (
          <View style={styles.loadWrap}>
            <ActivityIndicator size="small" color="#60a5fa" />
            <Text style={styles.loadText}>Transcribing…</Text>
          </View>
        ) : transcript !== null ? (
          <View>
            <Text style={styles.doneLabel}>✓ Recorded</Text>
            <Text style={styles.transcript} numberOfLines={3}>{transcript || '(empty)'}</Text>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={startRecording}>
              <Text style={styles.btnText}>Re-record</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={startRecording}>
            <Text style={styles.btnText}>Record voice note</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.completeBtn, (!photoUri || completing) && styles.completeBtnDisabled]}
        onPress={complete}
        disabled={!photoUri || completing}
      >
        {completing ? (
          <ActivityIndicator size="small" color="#0a0a0a" />
        ) : (
          <Text style={styles.completeBtnText}>Complete step</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#141414', padding: 24 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#fca5a5' },
  backBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 },
  backBtnText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#fafafa' },
  container: { flex: 1, backgroundColor: '#141414', padding: 24 },
  header: { marginBottom: 24 },
  stepLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#71717a', marginBottom: 4 },
  title: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 18, color: '#fafafa' },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#a1a1aa', marginBottom: 10 },
  btn: { alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: 'rgba(59,130,246,0.2)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)', borderRadius: 10 },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' },
  btnDanger: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.4)' },
  btnText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#fafafa' },
  thumbWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 80, height: 80, borderRadius: 10 },
  doneLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#86efac' },
  loadWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#a1a1aa' },
  transcript: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#a1a1aa', marginTop: 6, marginBottom: 10 },
  completeBtn: { marginTop: 8, paddingVertical: 16, backgroundColor: '#22c55e', borderRadius: 12, alignItems: 'center' },
  completeBtnDisabled: { opacity: 0.5 },
  completeBtnText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#0a0a0a' },
})
