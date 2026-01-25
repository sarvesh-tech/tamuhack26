import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useInspectionPhotoUrl(photoPath: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!photoPath) {
      setUrl(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase.storage
      .from('inspection-evidence')
      .createSignedUrl(photoPath, 3600)
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(e.message)
        else setUrl(data?.signedUrl ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [photoPath])

  return { url, loading, error }
}
