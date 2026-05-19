import { useEffect, useRef } from 'react'

/**
 * Calls `refresh()` whenever the page becomes visible again
 * (user switches back to the app/tab from background).
 */
export function useRefreshOnFocus(refresh: () => void) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) refreshRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
}
