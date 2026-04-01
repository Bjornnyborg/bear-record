import { useState, useEffect, useCallback } from 'react'
import type { SourceInfo } from '../../shared/types'

export function useMediaSources() {
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const s = await window.electronAPI.getSources()
      setSources(s)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { sources, loading, refresh }
}
