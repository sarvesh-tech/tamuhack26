import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ActiveSession = {
  id: string
  started_at: string
  progress_pct: number
}

export function useActiveInspectionSessions(enabled: boolean) {
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setSessions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const fetchActive = async (isInitial: boolean) => {
      if (isInitial) setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        if (isInitial) setLoading(false)
        return
      }

      const { data, error: e } = await supabase
        .from('inspection_sessions')
        .select('id, started_at, progress_pct')
        .eq('inspector_id', user.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(10)

      if (cancelled) return

      if (e) {
        setError(e.message)
        setSessions([])
      } else {
        setSessions((data ?? []) as ActiveSession[])
      }

      if (isInitial) setLoading(false)
    }

    fetchActive(true)

    const channel = supabase
      .channel('active-inspection-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspection_sessions' },
        () => {
          fetchActive(false)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [enabled])

  return { sessions, loading, error }
}
