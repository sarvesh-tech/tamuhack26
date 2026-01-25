import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

const PRE_HEADLINE = 'REAL-TIME INSPECTION VERIFICATION FOR FLIGHT OPERATIONS.'
const DESCRIPTION =
  'A real-time inspection system for airline operations that replaces manual checklists with live visual verification, automated logging, and defensible audit artifacts.'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setAuthOpen(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setMessage({ type: 'error', text: error.message })
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
    setAuthOpen(false)
  }

  return (
    <div className="page">
      <header className="nav">
        <div className="nav__inner">
          <a href="/" className="nav__logo" aria-label="AIsleØ home">
            <img src="/IconLogo.png" alt="" className="nav__logo-img" />
          </a>
          <nav className="nav__links">
            <a href="#dashboard" className="nav__link">DASHBOARD</a>
            <a href="#about" className="nav__link">ABOUT</a>
            <a href="#demo" className="nav__link">DEMO</a>
          </nav>
          <div className="nav__right">
            <span className="nav__active">
              <span className="nav__active-dot" aria-hidden /> ACTIVE
            </span>
            {session ? (
              <button type="button" className="nav__btn" onClick={signOut}>
                Sign out
              </button>
            ) : (
              <button type="button" className="nav__btn" onClick={() => setAuthOpen(true)}>
                LOGIN
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="hero">
        <div className="hero__left">
          <p className="hero__pre">{PRE_HEADLINE}</p>
          <img src="/TextLogo.png" alt="AIsleØ" className="hero__logo" />
          <hr className="hero__hr" />
          <p className="hero__desc">{DESCRIPTION}</p>
        </div>
        <div className="hero__right" aria-hidden>
          {/* Placeholder for animated GIF */}
        </div>
      </main>

      {authOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="modal__backdrop" onClick={() => setAuthOpen(false)} />
          <div className="modal__box">
            <div className="modal__head">
              <h2 className="modal__title">Sign in</h2>
              <button
                type="button"
                className="modal__close"
                onClick={() => setAuthOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal__body">
              <button
                type="button"
                className="auth-btn auth-btn--primary"
                onClick={signInWithGoogle}
                disabled={loading}
              >
                {loading ? (
                  '…'
                ) : (
                  <>
                    <svg className="auth-btn__google" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </>
                )}
              </button>
              <div className="auth-divider"><span>or</span></div>
              <form className="auth-form" onSubmit={signInWithEmail}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  disabled={loading}
                  autoComplete="email"
                />
                <button type="submit" className="auth-btn auth-btn--secondary" disabled={loading}>
                  Email me a link
                </button>
              </form>
            </div>
            {message && (
              <p className={`auth-msg auth-msg--${message.type}`}>{message.text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
