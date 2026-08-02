import { useEffect, useState } from 'react'

export const ROUTES = ['/', '/rules', '/world-cup']

function readHashRoute() {
  const hashPath = window.location.hash.replace(/^#/, '') || '/'
  const normalizedPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`

  return ROUTES.includes(normalizedPath) ? normalizedPath : '/'
}

export function useHashRoute() {
  const [route, setRoute] = useState(readHashRoute)

  useEffect(() => {
    const handleHashChange = () => setRoute(readHashRoute())

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()

    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return route
}
