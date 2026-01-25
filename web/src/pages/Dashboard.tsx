import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import type { Flight } from '../lib/flightEngine'

type TabId = 'overview' | 'audit-logs' | 'inspections'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit-logs', label: 'Audit logs' },
  { id: 'inspections', label: 'Inspections' },
]

const ROWS = 30
const COLS = 6
const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function getSeatId(row: number, col: number): string {
  return `${row + 1}${SEAT_LETTERS[col]}`
}

export function Dashboard() {
  const { state } = useLocation() as { state?: { flight: Flight } | null }
  const flight = state?.flight ?? null
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set())

  const totalSeats = flight?.aircraft.passengerCapacity.total ?? ROWS * COLS
  const seatCount = Math.min(ROWS * COLS, totalSeats)

  function toggleSeat(id: string) {
    setSelectedSeats((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function includesSeat(r: number, c: number): boolean {
    return r * 6 + c < seatCount
  }

  return (
    <div className="dashboard">
      <aside className="dashboard__sidebar">
        <nav className="dashboard__nav" aria-label="Dashboard sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`dashboard__nav-link ${activeTab === tab.id ? 'dashboard__nav-link--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="dashboard__main">
        {activeTab === 'overview' ? (
          <div className="dashboard__overview-wrap">
            <section className="dashboard__seats-section" aria-label="Seat map">
              <div className="dashboard__seats-head">
                <h2 className="dashboard__seats-title">Seat map</h2>
                <p className="dashboard__seats-legend">
                  <span className="dashboard__seats-legend-item"><em className="dashboard__seats-legend-swatch" /> Available</span>
                  <span className="dashboard__seats-legend-item"><em className="dashboard__seats-legend-swatch dashboard__seats-legend-swatch--selected" /> Selected</span>
                </p>
              </div>
              <div className="dashboard__seat-grid-wrap">
              <div className="dashboard__seat-grid">
                {Array.from({ length: 15 }, (_, i) => i).map((r) => (
                  <div key={r} className="dashboard__seat-row">
                    <span className="dashboard__seat-row-num">{r + 1}</span>
                    {[0, 1, 2].map((c) => {
                      const id = getSeatId(r, c)
                      if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`dashboard__seat ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                          onClick={() => toggleSeat(id)}
                          aria-pressed={selectedSeats.has(id)}
                          aria-label={`Seat ${id}`}
                          title={id}
                        >
                          {id.slice(-1)}
                        </button>
                      )
                    })}
                    <span className="dashboard__aisle" aria-hidden />
                    {[3, 4, 5].map((c) => {
                      const id = getSeatId(r, c)
                      if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`dashboard__seat ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                          onClick={() => toggleSeat(id)}
                          aria-pressed={selectedSeats.has(id)}
                          aria-label={`Seat ${id}`}
                          title={id}
                        >
                          {id.slice(-1)}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="dashboard__seat-grid">
                {Array.from({ length: 15 }, (_, i) => i + 15).map((r) => (
                  <div key={r} className="dashboard__seat-row">
                    <span className="dashboard__seat-row-num">{r + 1}</span>
                    {[0, 1, 2].map((c) => {
                      const id = getSeatId(r, c)
                      if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`dashboard__seat ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                          onClick={() => toggleSeat(id)}
                          aria-pressed={selectedSeats.has(id)}
                          aria-label={`Seat ${id}`}
                          title={id}
                        >
                          {id.slice(-1)}
                        </button>
                      )
                    })}
                    <span className="dashboard__aisle" aria-hidden />
                    {[3, 4, 5].map((c) => {
                      const id = getSeatId(r, c)
                      if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`dashboard__seat ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                          onClick={() => toggleSeat(id)}
                          aria-pressed={selectedSeats.has(id)}
                          aria-label={`Seat ${id}`}
                          title={id}
                        >
                          {id.slice(-1)}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            </section>
            <div className="dashboard__flight-info">
              <h1 className="dashboard__flight-number">
                {flight ? `AA${flight.flightNumber}` : '—'}
              </h1>
              <p className="dashboard__flight-route">
                {flight
                  ? `${flight.origin.city} (${flight.origin.code}) → ${flight.destination.city} (${flight.destination.code})`
                  : 'From — to —'}
              </p>
              {!flight && (
                <p className="dashboard__flight-hint">
                  <Link to="/find-flight">Select a flight</Link> and click Continue to view the dashboard.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="dashboard__flight-info">
              <h1 className="dashboard__flight-number">
                {flight ? `AA${flight.flightNumber}` : '—'}
              </h1>
              <p className="dashboard__flight-route">
                {flight
                  ? `${flight.origin.city} (${flight.origin.code}) → ${flight.destination.city} (${flight.destination.code})`
                  : 'From — to —'}
              </p>
              {!flight && (
                <p className="dashboard__flight-hint">
                  <Link to="/find-flight">Select a flight</Link> and click Continue to view the dashboard.
                </p>
              )}
            </div>
            {activeTab === 'audit-logs' && (
              <section className="dashboard__panel" aria-label="Audit logs">
                <h2 className="dashboard__panel-title">Audit logs</h2>
                <p className="dashboard__panel-empty">Audit log entries will appear here.</p>
              </section>
            )}
            {activeTab === 'inspections' && (
              <section className="dashboard__panel" aria-label="Inspections">
                <h2 className="dashboard__panel-title">Inspections</h2>
                <p className="dashboard__panel-empty">Inspection records will appear here.</p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
