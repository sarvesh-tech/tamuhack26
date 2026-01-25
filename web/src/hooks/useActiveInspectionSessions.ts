import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ActiveSession = {
  id: string
  started_at: string
  progress_pct: number
  flight_number?: string | null
}

export function useActiveInspectionSessions(enabled: boolean, flightNumber?: string | null, fetchAll: boolean = false) {
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

      let user = null
      if (!fetchAll) {
        const { data } = await supabase.auth.getUser()
        user = data.user
        if (!user || cancelled) {
          if (isInitial) setLoading(false)
          return
        }
      }

      let query = supabase
        .from('inspection_sessions')
        .select('id, started_at, progress_pct, flight_number')

      if (fetchAll) {
        // Query all active 
      } else if (flightNumber) {
        query = query.eq('flight_number', flightNumber)
      } else {
        // Fallback to my sessions if no flight selected
        if (user) query = query.eq('inspector_id', user.id)
      }

      const { data, error: e } = await query
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(20)

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
  }, [enabled, flightNumber, fetchAll])

  return { sessions, loading, error }
}
