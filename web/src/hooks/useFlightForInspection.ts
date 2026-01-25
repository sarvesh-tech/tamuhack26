import { useEffect, useState } from 'react'
import { getFlights } from '../lib/flightEngine'
import type { Flight } from '../lib/flightEngine'
import type { InspectionSession } from './useInspectionSession'
import { supabase } from '../lib/supabase'

function todayYYYYMMDD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function resolveFlightFromEngine(fn: string): Promise<Flight | null> {
  let list = await getFlights(todayYYYYMMDD(), undefined, undefined, fn)
  let f = list?.[0] ?? null
  if (!f && fn.startsWith('AA')) {
    list = await getFlights(todayYYYYMMDD(), undefined, undefined, fn.slice(2))
    return list?.[0] ?? null
  }
  return f
}

/**
 * Resolves the Flight for the dashboard: uses stateFlight when present (from
 * Find Flight → Continue), otherwise from session.flight_number, or from
 * user_flights for the session's inspector or the current user.
 */
export function useFlightForInspection(
  session: InspectionSession | null,
  stateFlight: Flight | null
): { flight: Flight | null; loading: boolean } {
  const [resolved, setResolved] = useState<Flight | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (stateFlight) {
      setResolved(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setResolved(null)
    ;(async () => {
      try {
        let fn: string | null = session?.flight_number ?? null

        if (!fn && session) {
          const { data } = await supabase
            .from('user_flights')
            .select('flight_number')
            .eq('user_id', session.inspector_id)
            .maybeSingle()
          if (cancelled) return
          fn = data?.flight_number ?? null
        }

        if (!fn) {
          const { data: { user } } = await supabase.auth.getUser()
          if (cancelled || !user) {
            if (!cancelled) setLoading(false)
            return
          }
          const { data } = await supabase
            .from('user_flights')
            .select('flight_number')
            .eq('user_id', user.id)
            .maybeSingle()
          if (cancelled) return
          fn = data?.flight_number ?? null
        }

        if (!fn || cancelled) {
          if (!cancelled) setLoading(false)
          return
        }

        const f = await resolveFlightFromEngine(fn)
        if (!cancelled) setResolved(f)
      } catch {
        if (!cancelled) setResolved(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stateFlight, session?.id, session?.flight_number, session?.inspector_id])

  return {
    flight: stateFlight ?? resolved,
    loading,
  }
}
