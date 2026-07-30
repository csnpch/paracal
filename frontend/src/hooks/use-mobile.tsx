import * as React from "react"

export const MOBILE_BREAKPOINT = 768

const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function getIsMobileViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => getIsMobileViewport())

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)

    const sync = () => {
      setIsMobile(mql.matches)
    }

    mql.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
    sync()

    return () => {
      mql.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync)
    }
  }, [])

  return isMobile
}
