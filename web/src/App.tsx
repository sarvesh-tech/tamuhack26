import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setAuthOpen(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (session && location.pathname === '/') navigate('/dashboard', { replace: true })
    if (!session && location.pathname === '/dashboard') navigate('/', { replace: true })
  }, [authReady, session, location.pathname, navigate])

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

  function signOut() {
    supabase.auth.signOut()
    setMessage(null)
    setAuthOpen(false)
  }

  if (!authReady) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span style={{ color: '#71717a', fontFamily: 'Inter, sans-serif' }}>Loading…</span>
      </div>
    )
  }

  return (
    <>
      <Routes>
        <Route element={<Layout session={session} onSignOut={signOut} onOpenAuth={() => setAuthOpen(true)} />}>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>

      {authOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Sign in">
          <div className="modal__backdrop" onClick={() => setAuthOpen(false)} />
          <div className="modal__box">
            <div className="modal__head">
              <h2 className="modal__title">Sign in</h2>
              <button type="button" className="modal__close" onClick={() => setAuthOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="modal__body">
              <button type="button" className="auth-btn auth-btn--primary" onClick={signInWithGoogle} disabled={loading}>
                {loading ? '…' : (
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
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" disabled={loading} autoComplete="email" />
                <button type="submit" className="auth-btn auth-btn--secondary" disabled={loading}>Email me a link</button>
              </form>
            </div>
            {message && <p className={`auth-msg auth-msg--${message.type}`}>{message.text}</p>}
          </div>
        </div>
      )}
    </>
  )
}

export default App
