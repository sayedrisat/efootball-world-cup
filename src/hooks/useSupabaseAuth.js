import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function useSupabaseAuth() {
  const [adminError, setAdminError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.location.hash.includes('type=recovery') ||
        new URLSearchParams(window.location.search).get('type') === 'recovery' ||
        new URLSearchParams(window.location.search).get('recovery') === '1',
  )
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let isActive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isActive) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setAdminError('')
      setAdminLoading(false)
      setIsAdmin(false)
      return undefined
    }

    let isActive = true
    setAdminLoading(true)

    supabase
      .from('tournament_admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isActive) return
        setIsAdmin(Boolean(data) && !error)
        setAdminError(error?.message || '')
        setAdminLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [session])

  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase is not configured yet.')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const sendPasswordReset = async (email) => {
    if (!supabase) throw new Error('Supabase is not configured yet.')

    const recoveryUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    recoveryUrl.searchParams.set('recovery', '1')
    const redirectTo = recoveryUrl.toString()
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  const updatePassword = async (password) => {
    if (!supabase) throw new Error('Supabase is not configured yet.')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error

    const cleanUrl = new URL(window.location.href)
    cleanUrl.searchParams.delete('recovery')
    cleanUrl.searchParams.delete('type')
    window.history.replaceState({}, '', `${cleanUrl.pathname}#/admin`)
    setIsPasswordRecovery(false)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }

  return {
    adminError,
    adminLoading,
    isConfigured: isSupabaseConfigured,
    isAdmin,
    isPasswordRecovery,
    loading,
    sendPasswordReset,
    session,
    signIn,
    signOut,
    updatePassword,
  }
}
