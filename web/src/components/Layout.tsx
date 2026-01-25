import { useState, useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type LayoutProps = {
  session: { user: { email?: string; id?: string; user_metadata?: { name?: string } } } | null
  onSignOut: () => void
  onOpenAuth: () => void
}

const ROLES = ['Pilot', 'Flight Attendant', 'Mechanic', 'Ground Crew']

export function Layout({ session, onSignOut, onOpenAuth }: LayoutProps) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error('Profile fetch error:', error)
          if (data?.role) setCurrentRole(data.role)
          // If no profile exists, it will be created when user sets role
        })
    }
  }, [session?.user?.id])

  const handleSaveRole = async (role: string) => {
    if (!session?.user?.id) return
    setSaving(true)
    await supabase.from('profiles').upsert({ id: session.user.id, role })
    setCurrentRole(role)
    setSaving(false)
    setProfileOpen(false)
  }

  return (
    <div className="page">
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" className="nav__logo" aria-label="AIsle\u00d8 home">
            <img src="/IconLogo.png" alt="" className="nav__logo-img" />
          </Link>
          <nav className="nav__links">
            <Link to="/find-flight" className="nav__link">FIND FLIGHT</Link>
            <Link to="/dashboard" className="nav__link">DASHBOARD</Link>
            <a href="#about" className="nav__link">ABOUT</a>
            <a href="#demo" className="nav__link">DEMO</a>
          </nav>
          <div className="nav__right">
            <span className="nav__active">
              <span className="nav__active-dot" aria-hidden /> ACTIVE
            </span>
            {session ? (
              <>
                <button 
                  type="button" 
                  className="nav__btn" 
                  onClick={() => setProfileOpen(true)}
                  style={{ marginRight: '0.5rem' }}
                >
                  {currentRole || 'Set Role'}
                </button>
                <button type="button" className="nav__btn" onClick={onSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <button type="button" className="nav__btn" onClick={onOpenAuth}>
                LOGIN
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Profile/Role Editor Modal */}
      {profileOpen && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 200, 
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setProfileOpen(false)}
        >
          <div 
            style={{ 
              background: '#1c1c1e', padding: '2rem', borderRadius: '16px', 
              maxWidth: '400px', width: '90%', border: '1px solid rgba(255,255,255,0.1)' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Edit Profile</h2>
            <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {session?.user?.email}<br/>
              Current Role: <strong style={{ color: '#fafafa' }}>{currentRole || 'Not set'}</strong>
            </p>
            <p style={{ color: '#a1a1aa', marginBottom: '1rem', fontSize: '0.85rem' }}>Select Role:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {ROLES.map(r => (
                <button 
                  key={r}
                  onClick={() => handleSaveRole(r)}
                  disabled={saving}
                  style={{ 
                    padding: '0.75rem', borderRadius: '10px', border: 'none', 
                    background: currentRole === r ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)', 
                    color: '#fff', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setProfileOpen(false)} 
              style={{ 
                marginTop: '1.5rem', width: '100%', padding: '0.75rem', 
                background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', 
                border: 'none', borderRadius: '8px', cursor: 'pointer' 
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Outlet context={{ session }} />
    </div>
  )
}

