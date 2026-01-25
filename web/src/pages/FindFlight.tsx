import { useState, useMemo, useEffect, useRef } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type { Flight } from '../lib/flightEngine'
import { supabase } from '../lib/supabase'
import { useFlights } from '../hooks/useFlights'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { RouteMap } from '../components/RouteMap'
import { PlaneModelViewer } from '../components/PlaneModelViewer'

type TimeFilter = '1-hour' | '12-hours' | 'all'
type SortBy = 'departure' | 'flightNumber' | 'origin' | 'destination' | 'aircraft'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'departure', label: 'Departure time' },
  { value: 'flightNumber', label: 'Flight number' },
  { value: 'origin', label: 'Origin' },
  { value: 'destination', label: 'Destination' },
  { value: 'aircraft', label: 'Aircraft' },
]

function displayName(session: Session | null): string {
  if (!session?.user) return 'there'
  const { user_metadata, email } = session.user
  return user_metadata?.full_name ?? user_metadata?.name ?? user_metadata?.user_name ?? (email?.split('@')[0] || 'there')
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

function matchesSearch(flight: Flight, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.toLowerCase().trim()
  return (
    flight.flightNumber.toLowerCase().includes(lower) ||
    flight.origin.code.toLowerCase().includes(lower) ||
    flight.destination.code.toLowerCase().includes(lower) ||
    flight.aircraft.model.toLowerCase().includes(lower)
  )
}

function isWithin1Hour(flight: Flight): boolean {
  const now = Date.now()
  const dep = new Date(flight.departureTime).getTime()
  const oneHour = 60 * 60 * 1000
  return dep >= now && dep <= now + oneHour
}

function isWithin12Hours(flight: Flight): boolean {
  const now = Date.now()
  const dep = new Date(flight.departureTime).getTime()
  const twelveHours = 12 * 60 * 60 * 1000
  return dep >= now && dep <= now + twelveHours
}

function compareFlights(a: Flight, b: Flight, sortBy: SortBy): number {
  switch (sortBy) {
    case 'departure':
      return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    case 'flightNumber':
      return a.flightNumber.localeCompare(b.flightNumber, undefined, { numeric: true })
    case 'origin':
      return a.origin.code.localeCompare(b.origin.code)
    case 'destination':
      return a.destination.code.localeCompare(b.destination.code)
    case 'aircraft':
      return a.aircraft.model.localeCompare(b.aircraft.model)
    default:
      return 0
  }
}

type OutletContext = { session: Session | null }

export function FindFlight() {
  const { session } = useOutletContext<OutletContext>()
  const name = displayName(session)
  const { flights, loading, error } = useFlights({ date: undefined })
  const [search, setSearch] = useState('')
  const searchDebounced = useDebouncedValue(search, 200)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('1-hour')
  const [sortBy, setSortBy] = useState<SortBy>('departure')
  const [sortOpen, setSortOpen] = useState(false)
  const [tick, setTick] = useState(0)
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (timeFilter !== '1-hour') return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [timeFilter])

  useEffect(() => {
    if (!sortOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [sortOpen])

  const filtered = useMemo(() => {
    let list = flights
    if (timeFilter === '1-hour') list = list.filter(isWithin1Hour)
    else if (timeFilter === '12-hours') list = list.filter(isWithin12Hours)
    list = list.filter((f) => matchesSearch(f, searchDebounced))
    return [...list].sort((a, b) => compareFlights(a, b, sortBy))
  }, [flights, searchDebounced, timeFilter, sortBy, tick])

  return (
    <main className="find-flight">
      <div className="find-flight__header">
        <p className="find-flight__welcome">Welcome back, {name}</p>
        <h1 className="find-flight__title">Find flight</h1>
        <p className="find-flight__subtitle">Fleet overview and inspection status</p>
      </div>

      <section className="find-flight__search">
        <label className="find-flight__label" htmlFor="plane-search">
          Search & select plane
        </label>
        <input
          id="plane-search"
          type="text"
          placeholder="Search by flight number, origin, destination, or aircraft model…"
          className="find-flight__input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-describedby="plane-search-hint"
        />
        <p id="plane-search-hint" className="find-flight__hint">
          Filter by flight number, airport code, or aircraft model.
        </p>
      </section>

      <div className="find-flight__filter-row">
        <div className="find-flight__filter-tabs" role="tablist" aria-label="Time filter">
          <button
            type="button"
            role="tab"
            aria-selected={timeFilter === '1-hour'}
            aria-controls="flights-panel"
            id="tab-1-hour"
            className={`find-flight__filter-tab ${timeFilter === '1-hour' ? 'find-flight__filter-tab--active' : ''}`}
            onClick={() => setTimeFilter('1-hour')}
          >
            1 hour
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={timeFilter === '12-hours'}
            aria-controls="flights-panel"
            id="tab-12-hours"
            className={`find-flight__filter-tab ${timeFilter === '12-hours' ? 'find-flight__filter-tab--active' : ''}`}
            onClick={() => setTimeFilter('12-hours')}
          >
            12 hours
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={timeFilter === 'all'}
            aria-controls="flights-panel"
            id="tab-all"
            className={`find-flight__filter-tab ${timeFilter === 'all' ? 'find-flight__filter-tab--active' : ''}`}
            onClick={() => setTimeFilter('all')}
          >
            All
          </button>
        </div>
        <div className="find-flight__sort-wrap" ref={sortRef}>
          <button
            type="button"
            className="find-flight__sort-btn"
            onClick={(e) => { e.stopPropagation(); setSortOpen((o) => !o) }}
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            aria-label="Sort and filter"
          >
            <svg className="find-flight__sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="14" x2="14" y2="14" />
              <line x1="4" y1="20" x2="10" y2="20" />
            </svg>
            <span>Sort</span>
          </button>
          {sortOpen && (
            <ul className="find-flight__sort-dropdown" role="listbox" tabIndex={-1}>
              {SORT_OPTIONS.map((opt) => (
                <li key={opt.value} role="option" aria-selected={sortBy === opt.value}>
                  <button
                    type="button"
                    className={`find-flight__sort-opt ${sortBy === opt.value ? 'find-flight__sort-opt--active' : ''}`}
                    onClick={() => { setSortBy(opt.value); setSortOpen(false) }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {error && (
        <div className="find-flight__error-banner" role="alert">
          Flight Engine unavailable. Check Render URL or proxy.
        </div>
      )}

      {loading && <p className="find-flight__loading">Loading flights…</p>}

      {!loading && !error && selectedFlight ? (
        <div id="flights-panel" className="find-flight__detail-view" role="region" aria-label="Flight details">
          <div className="find-flight__canvas-placeholder" id="find-flight-three-container">
            <PlaneModelViewer />
          </div>
          <div className="find-flight__detail-panel">
            <button
              type="button"
              className="find-flight__detail-back"
              onClick={() => setSelectedFlight(null)}
              aria-label="Back to flight list"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="find-flight__detail-content">
              <h2 className="find-flight__detail-title">AA{selectedFlight.flightNumber}</h2>
              <div className="find-flight__detail-route">
                <div className="find-flight__detail-route-legs">
                  <span className="find-flight__detail-airport">
                    <strong>{selectedFlight.origin.code}</strong>
                    <em>{selectedFlight.origin.city}</em>
                  </span>
                  <span className="find-flight__detail-arrow" aria-hidden>→</span>
                  <span className="find-flight__detail-airport">
                    <strong>{selectedFlight.destination.code}</strong>
                    <em>{selectedFlight.destination.city}</em>
                  </span>
                </div>
                <RouteMap origin={selectedFlight.origin} destination={selectedFlight.destination} />
              </div>
              <dl className="find-flight__detail-meta">
                <div className="find-flight__detail-meta-row">
                  <dt>Departure</dt>
                  <dd>{formatDateTime(selectedFlight.departureTime)}</dd>
                </div>
                <div className="find-flight__detail-meta-row">
                  <dt>Arrival</dt>
                  <dd>{formatDateTime(selectedFlight.arrivalTime)}</dd>
                </div>
                <div className="find-flight__detail-meta-row">
                  <dt>Duration</dt>
                  <dd>{selectedFlight.duration.locale}</dd>
                </div>
                <div className="find-flight__detail-meta-row">
                  <dt>Aircraft</dt>
                  <dd>{selectedFlight.aircraft.model} · {selectedFlight.aircraft.speed} mph · {selectedFlight.aircraft.passengerCapacity.total} seats</dd>
                </div>
                <div className="find-flight__detail-meta-row">
                  <dt>Distance</dt>
                  <dd>{selectedFlight.distance.toLocaleString()} km</dd>
                </div>
              </dl>
            </div>
            <button
              type="button"
              className="find-flight__detail-continue"
              onClick={async () => {
                const userId = session?.user?.id
                const flightNumber = `AA${selectedFlight.flightNumber}`
                if (userId) {
                  await supabase.from('user_flights').upsert(
                    { user_id: userId, flight_number: flightNumber, selected_at: new Date().toISOString() },
                    { onConflict: 'user_id' }
                  )
                }
                navigate('/dashboard', { state: { flight: selectedFlight } })
              }}
            >
              Continue
              <span className="find-flight__detail-continue-arrow" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      ) : !loading && !error ? (
        <div id="flights-panel" className="find-flight__flights-grid" role="list">
          {filtered.map((f) => (
            <button
              key={`${f.flightNumber}-${f.origin.code}-${f.destination.code}-${f.departureTime}`}
              type="button"
              role="listitem"
              className="find-flight__flights-tile"
              onClick={() => setSelectedFlight(f)}
            >
              <img src="/aalogo.png" alt="" className="find-flight__flights-logo" aria-hidden />
              <div className="find-flight__flights-tile-body">
                <span className="find-flight__flights-route">
                  {f.origin.code} → {f.destination.code}
                </span>
                <span className="find-flight__flights-label">
                  AA{f.flightNumber} · {f.aircraft.model}
                </span>
                <span className="find-flight__flights-secondary">
                  {formatTime(f.departureTime)} – {formatTime(f.arrivalTime)}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </main>
  )
}
