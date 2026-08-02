import { KeyRound, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useState } from 'react'

function AdminLoginPanel({ onResetPassword, onSignIn }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await onSignIn(email.trim(), password)
      setPassword('')
    } catch (signInError) {
      setError(signInError.message || 'Could not sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('Enter your admin email first.')
      return
    }

    setError('')
    setResetMessage('')
    setIsSubmitting(true)

    try {
      await onResetPassword(email.trim())
      setResetMessage('Password reset link sent. Check your email inbox.')
    } catch (resetError) {
      setError(resetError.message || 'Could not send the reset email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="league-card admin-login-panel">
      <div className="admin-login-mark">
        <LockKeyhole size={28} />
      </div>
      <div>
        <span className="league-kicker">Tournament Control</span>
        <h1>Admin Sign In</h1>
        <p>Authorized account access only.</p>
      </div>

      <form className="admin-login-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error && <p className="admin-form-error">{error}</p>}
        {resetMessage && <p className="admin-form-success">{resetMessage}</p>}
        <button className="league-primary-action" disabled={isSubmitting} type="submit">
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
          {isSubmitting ? 'Signing In' : 'Sign In'}
        </button>
        <button
          className="admin-forgot-button"
          disabled={isSubmitting}
          onClick={handlePasswordReset}
          type="button"
        >
          Forgot password?
        </button>
      </form>
    </section>
  )
}

export default AdminLoginPanel
