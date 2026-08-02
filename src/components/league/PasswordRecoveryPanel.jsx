import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

function PasswordRecoveryPanel({ onUpdatePassword }) {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [password, setPassword] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await onUpdatePassword(password)
    } catch (updateError) {
      setError(updateError.message || 'Could not update the password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="league-card admin-login-panel">
      <div className="admin-login-mark">
        <ShieldCheck size={28} />
      </div>
      <div>
        <span className="league-kicker">Secure Recovery</span>
        <h1>Set New Password</h1>
        <p>Choose a new password for the tournament admin account.</p>
      </div>

      <form className="admin-login-form" onSubmit={handleSubmit}>
        <label>
          New Password
          <input
            autoComplete="new-password"
            minLength="8"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          Confirm Password
          <input
            autoComplete="new-password"
            minLength="8"
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
        {error && <p className="admin-form-error">{error}</p>}
        <button className="league-primary-action" disabled={isSubmitting} type="submit">
          {isSubmitting ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}
          {isSubmitting ? 'Updating Password' : 'Update Password'}
        </button>
      </form>
    </section>
  )
}

export default PasswordRecoveryPanel
