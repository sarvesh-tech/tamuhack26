import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type InspectionSession = {
  id: string
  inspector_id: string
  inspector_email: string | null
  inspector_name: string | null
  flight_number: string | null
  status: 'active' | 'completed'
  started_at: string
  ended_at: string | null
  total_steps: number
  steps_completed: number
  progress_pct: number
  updated_at: string | null
}

export type InspectionStepInstance = {
  id: string
  session_id: string
  step_id: number
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  started_at: string | null
  completed_at: string | null
  photo_path: string | null
  transcript: string | null
  ai_severity?: 'low' | 'medium' | 'high' | null
  ai_analysis?: string | null
  completed_by?: string | null
}

export function useInspectionSession(sessionId: string | null) {
  const [session, setSession] = useState<InspectionSession | null>(null)
  const [steps, setSteps] = useState<InspectionStepInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (isInitial: boolean) => {
    if (!sessionId) return
    if (isInitial) setLoading(true)
    setError(null)

    const [sRes, stRes] = await Promise.all([
      supabase
        .from('inspection_sessions')
        .select('*')
        .eq('id', sessionId)
        .single(),
      supabase
        .from('inspection_step_instances')
        .select('*')
        .eq('session_id', sessionId)
        .order('step_id', { ascending: true }),
    ])

    if (sRes.error) {
      console.error("[useInspectionSession] Session Load Error:", sRes.error);
      setError(sRes.error.message)
      setSession(null)
    } else {
      setSession(sRes.data as InspectionSession)
    }

    if (stRes.error) {
      console.error("[useInspectionSession] Steps Load Error:", stRes.error);
      if (!sRes.error) setError(stRes.error.message)
      setSteps([])
    } else {
      console.log(`[useInspectionSession] Fetched ${stRes.data?.length ?? 0} steps for session ${sessionId}`);
      setSteps((stRes.data ?? []) as InspectionStepInstance[])
    }

    if (isInitial) setLoading(false)
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setSteps([])
      setLoading(false)
      setError(null)
      return
    }

    fetchData(true)

    const channel = supabase
      .channel(`inspection-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inspection_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("[useInspectionSession] Realtime Session Update:", payload);
          fetchData(false)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inspection_step_instances',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log("[useInspectionSession] Realtime Step Update:", payload);
          fetchData(false)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchData])


  const endSession = async () => {
    if (!sessionId) return
    const { error } = await supabase
      .from('inspection_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    if (error) throw error
  }

  const cancelSession = async () => {
    if (!sessionId) return
    const { error } = await supabase
      .from('inspection_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    if (error) throw error
  }

  const refresh = () => fetchData(false)

  // Use a Map to get only the unique latest instance of each step_id
  const uniqueSteps = Array.from(
    steps.reduce((acc, current) => {
      const existing = acc.get(current.step_id);
      if (!existing || (current.completed_at && (!existing.completed_at || current.completed_at > existing.completed_at))) {
        acc.set(current.step_id, current);
      }
      return acc;
    }, new Map<number, InspectionStepInstance>()).values()
  );

  const stepsCompletedCount = uniqueSteps.filter(s => s.status === 'completed' || s.status === 'skipped').length
  const progressPct = uniqueSteps.length > 0
    ? Math.round((stepsCompletedCount / (session?.total_steps || 15)) * 100)
    : 0

  return { session, steps: uniqueSteps, loading, error, endSession, cancelSession, refresh, stepsCompleted: stepsCompletedCount, progressPct }
}

