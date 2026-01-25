const PRE_HEADLINE = 'REAL-TIME INSPECTION VERIFICATION FOR FLIGHT OPERATIONS.'
const DESCRIPTION =
  'A real-time inspection system for airline operations that replaces manual checklists with live visual verification, automated logging, and defensible audit artifacts.'

export function Landing() {
  return (
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
  )
}
