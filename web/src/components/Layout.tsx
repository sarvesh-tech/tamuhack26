import { Link, Outlet } from 'react-router-dom'

type LayoutProps = {
  session: { user: { email?: string; user_metadata?: { name?: string } } } | null
  onSignOut: () => void
  onOpenAuth: () => void
}

export function Layout({ session, onSignOut, onOpenAuth }: LayoutProps) {
  return (
    <div className="page">
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" className="nav__logo" aria-label="AIsleØ home">
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
              <button type="button" className="nav__btn" onClick={onSignOut}>
                Sign out
              </button>
            ) : (
              <button type="button" className="nav__btn" onClick={onOpenAuth}>
                LOGIN
              </button>
            )}
          </div>
        </div>
      </header>
      <Outlet context={{ session }} />
    </div>
  )
}
