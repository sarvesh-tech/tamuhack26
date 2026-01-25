import { useEffect, useState } from 'react'
import { getFlights } from '../lib/flightEngine'
import type { Flight } from '../lib/flightEngine'

function todayYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type UseFlightsOpts = { date?: string }

export function useFlights(opts: UseFlightsOpts = {}) {
  const date = opts.date ?? todayYYYYMMDD()
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getFlights(date)
      .then((data) => {
        if (!cancelled) {
          setFlights(data ?? [])
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Request failed')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [date])

  return { flights, loading, error }
}
