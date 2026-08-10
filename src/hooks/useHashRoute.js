import { useEffect, useState } from 'react'
export const ROUTES = ['/', '/teams', '/groups', '/knockout', '/ranking', '/output', '/admin']
function readRoute() { const value = window.location.hash.replace(/^#/, '') || '/'; return ROUTES.includes(value) ? value : '/' }
export function useHashRoute() { const [route, setRoute] = useState(readRoute); useEffect(() => { const update = () => setRoute(readRoute()); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update) }, []); return route }
