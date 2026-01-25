import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) {
      setMessage({ type: 'error', text: error.message })
    }
    setLoading(false)
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }
    setMessage({ type: 'success', text: 'Check your email for the login link.' })
    setEmail('')
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setMessage(null)
  }

  return (
    <div className="landing">
      <div className="landing__inner">
        <h1 className="landing__title">Aisle</h1>
        <p className="landing__tagline">Get started in seconds.</p>

        {session ? (
          <div className="landing__authed">
            <p className="landing__welcome">
              Signed in as <strong>{session.user.email ?? session.user.user_metadata?.name ?? 'you'}</strong>
            </p>
            <button
              type="button"
              className="landing__btn landing__btn--secondary"
              onClick={signOut}
              disabled={loading}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="landing__auth">
            <button
              type="button"
              className="landing__btn landing__btn--primary"
              onClick={signInWithGoogle}
              disabled={loading}
            >
              {loading ? '…' : 'Sign in with Google'}
            </button>

            <div className="landing__divider">
              <span>or</span>
            </div>

            <form className="landing__email-form" onSubmit={signInWithEmail}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="landing__input"
                disabled={loading}
                autoComplete="email"
              />
              <button
                type="submit"
                className="landing__btn landing__btn--secondary"
                disabled={loading}
              >
                Email me a link
              </button>
            </form>
          </div>
        )}

        {message && (
          <p className={`landing__message landing__message--${message.type}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}

export default App
