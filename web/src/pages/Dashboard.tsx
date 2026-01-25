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

// Seat status types
type SeatStatus = 'available' | 'inspected' | 'problem'

// Mock inspection data - replace with real API data
interface InspectionProgress {
  totalSeats: number
  inspectedSeats: number
  problemSeats: number
  percentComplete: number
  lastUpdated: string
}

// Mock problem seats - replace with real data from backend
const MOCK_PROBLEM_SEATS = new Set(['3C', '7A', '12F', '18B', '25D'])
const MOCK_INSPECTED_SEATS = new Set([
  '1A', '1B', '1C', '1D', '1E', '1F',
  '2A', '2B', '2C', '2D', '2E', '2F',
  '3A', '3B', '3C', '3D', '3E', '3F',
  '4A', '4B', '5A', '7A', '7B', '7C',
  '10A', '10B', '12F', '15A', '18B',
])

function getSeatId(row: number, col: number): string {
  return `${row + 1}${SEAT_LETTERS[col]}`
}

function getSeatStatus(seatId: string): SeatStatus {
  if (MOCK_PROBLEM_SEATS.has(seatId)) return 'problem'
  if (MOCK_INSPECTED_SEATS.has(seatId)) return 'inspected'
  return 'available'
}

export function Dashboard() {
  const { state } = useLocation() as { state?: { flight: Flight } | null }
  const flight = state?.flight ?? null
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set())

  const totalSeats = flight?.aircraft.passengerCapacity.total ?? ROWS * COLS
  const seatCount = Math.min(ROWS * COLS, totalSeats)

  // Calculate inspection progress
  const inspectionProgress: InspectionProgress = {
    totalSeats: seatCount,
    inspectedSeats: MOCK_INSPECTED_SEATS.size,
    problemSeats: MOCK_PROBLEM_SEATS.size,
    percentComplete: Math.round((MOCK_INSPECTED_SEATS.size / seatCount) * 100),
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }

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
                <h2 className="dashboard__seats-title">Seat Map</h2>
                <p className="dashboard__seats-legend">
                  <span className="dashboard__seats-legend-item"><em className="dashboard__seats-legend-swatch" /> Available</span>
                  <span className="dashboard__seats-legend-item"><em className="dashboard__seats-legend-swatch dashboard__seats-legend-swatch--inspected" /> Inspected</span>
                  <span className="dashboard__seats-legend-item"><em className="dashboard__seats-legend-swatch dashboard__seats-legend-swatch--problem" /> Problem</span>
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
                        const status = getSeatStatus(id)
                        if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`dashboard__seat ${status === 'problem' ? 'dashboard__seat--problem' : ''} ${status === 'inspected' ? 'dashboard__seat--inspected' : ''} ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                            onClick={() => toggleSeat(id)}
                            aria-pressed={selectedSeats.has(id)}
                            aria-label={`Seat ${id}${status === 'problem' ? ' - Problem detected' : status === 'inspected' ? ' - Inspected' : ''}`}
                            title={id}
                          >
                            {id.slice(-1)}
                          </button>
                        )
                      })}
                      <span className="dashboard__aisle" aria-hidden />
                      {[3, 4, 5].map((c) => {
                        const id = getSeatId(r, c)
                        const status = getSeatStatus(id)
                        if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`dashboard__seat ${status === 'problem' ? 'dashboard__seat--problem' : ''} ${status === 'inspected' ? 'dashboard__seat--inspected' : ''} ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                            onClick={() => toggleSeat(id)}
                            aria-pressed={selectedSeats.has(id)}
                            aria-label={`Seat ${id}${status === 'problem' ? ' - Problem detected' : status === 'inspected' ? ' - Inspected' : ''}`}
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
                        const status = getSeatStatus(id)
                        if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`dashboard__seat ${status === 'problem' ? 'dashboard__seat--problem' : ''} ${status === 'inspected' ? 'dashboard__seat--inspected' : ''} ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                            onClick={() => toggleSeat(id)}
                            aria-pressed={selectedSeats.has(id)}
                            aria-label={`Seat ${id}${status === 'problem' ? ' - Problem detected' : status === 'inspected' ? ' - Inspected' : ''}`}
                            title={id}
                          >
                            {id.slice(-1)}
                          </button>
                        )
                      })}
                      <span className="dashboard__aisle" aria-hidden />
                      {[3, 4, 5].map((c) => {
                        const id = getSeatId(r, c)
                        const status = getSeatStatus(id)
                        if (!includesSeat(r, c)) return <span key={c} className="dashboard__seat dashboard__seat--spacer" aria-hidden />
                        return (
                          <button
                            key={c}
                            type="button"
                            className={`dashboard__seat ${status === 'problem' ? 'dashboard__seat--problem' : ''} ${status === 'inspected' ? 'dashboard__seat--inspected' : ''} ${selectedSeats.has(id) ? 'dashboard__seat--selected' : ''}`}
                            onClick={() => toggleSeat(id)}
                            aria-pressed={selectedSeats.has(id)}
                            aria-label={`Seat ${id}${status === 'problem' ? ' - Problem detected' : status === 'inspected' ? ' - Inspected' : ''}`}
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

            {/* Progress Summary - Right Side */}
            <aside className="dashboard__progress-panel" aria-label="Inspection progress">
              <div className="dashboard__progress-header">
                <h2 className="dashboard__progress-panel-title">Inspection Progress</h2>
                <span className="dashboard__progress-badge">{inspectionProgress.percentComplete}% Complete</span>
              </div>

              <div className="dashboard__progress-stat-card dashboard__progress-stat-card--primary">
                <div className="dashboard__progress-stat-icon">✓</div>
                <div className="dashboard__progress-stat-content">
                  <div className="dashboard__progress-stat-value">{inspectionProgress.inspectedSeats}<span className="dashboard__progress-stat-total">/{inspectionProgress.totalSeats}</span></div>
                  <div className="dashboard__progress-stat-label">Seats Inspected</div>
                </div>
              </div>

              <div className="dashboard__progress-stat-card dashboard__progress-stat-card--danger">
                <div className="dashboard__progress-stat-icon">!</div>
                <div className="dashboard__progress-stat-content">
                  <div className="dashboard__progress-stat-value">{inspectionProgress.problemSeats}</div>
                  <div className="dashboard__progress-stat-label">Problems Detected</div>
                </div>
              </div>

              <div className="dashboard__progress-bar-container">
                <div className="dashboard__progress-bar-label">Overall Progress</div>
                <div className="dashboard__progress-bar" role="progressbar" aria-valuenow={inspectionProgress.percentComplete} aria-valuemin={0} aria-valuemax={100}>
                  <div className="dashboard__progress-bar-fill" style={{ width: `${inspectionProgress.percentComplete}%` }} />
                </div>
                <div className="dashboard__progress-bar-text">{inspectionProgress.percentComplete}%</div>
              </div>

              <div className="dashboard__progress-footer">
                <svg className="dashboard__progress-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Updated {inspectionProgress.lastUpdated}</span>
              </div>
            </aside>
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
