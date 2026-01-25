import { useEffect, useState } from 'react'
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
}

export function useInspectionSession(sessionId: string | null) {
  const [session, setSession] = useState<InspectionSession | null>(null)
  const [steps, setSteps] = useState<InspectionStepInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setSteps([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const fetchData = async (isInitial: boolean) => {
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

      if (cancelled) return

      if (sRes.error) {
        setError(sRes.error.message)
        setSession(null)
      } else {
        setSession(sRes.data as InspectionSession)
      }

      if (stRes.error) {
        if (!sRes.error) setError(stRes.error.message)
        setSteps([])
      } else {
        setSteps((stRes.data ?? []) as InspectionStepInstance[])
      }

      if (isInitial) setLoading(false)
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
        () => {
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
        () => {
          fetchData(false)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])


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
        status: 'completed', // or 'cancelled' if we have that status, but type says only active | completed.
        // If we want to support 'cancelled', we might need to update the type definition on line 10.
        // For now let's assume 'completed' is the terminal state, maybe adds a note?
        // User request says "cancels should have confirmations".
        // Let's stick to 'completed' for now, but maybe we should add 'cancelled' to the type if the DB supports it.
        // Assuming DB check constraint might exist. Let's just use 'completed' for now and maybe updated_at.
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    if (error) throw error
  }

  return { session, steps, loading, error, endSession, cancelSession }
}
