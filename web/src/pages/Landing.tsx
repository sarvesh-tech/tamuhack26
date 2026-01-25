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
      <div className="hero__right">
        <div className="hero__img-wrapper">
          <div className="hero__sky" aria-hidden>
            <span className="hero__line hero__line--1" />
            <span className="hero__line hero__line--2" />
            <span className="hero__line hero__line--3" />
            <span className="hero__line hero__line--4" />
            <span className="hero__line hero__line--5" />
          </div>
          <img src="/paper.png" alt="" className="hero__paper" />
          <img src="/engineer.gif" alt="" className="hero__engineer" />
          <img src="/lilman.gif" alt="" className="hero__lilman" />
        </div>
      </div>
    </main>
  )
}
