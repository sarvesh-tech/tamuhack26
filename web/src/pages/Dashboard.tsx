import { useState, useMemo, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type { Flight } from '../lib/flightEngine'
import { useFlights } from '../hooks/useFlights'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

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

export function Dashboard() {
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
    <main className="dashboard">
      <div className="dashboard__header">
        <p className="dashboard__welcome">Welcome back, {name}</p>
        <h1 className="dashboard__title">Dashboard</h1>
        <p className="dashboard__subtitle">Fleet overview and inspection status</p>
      </div>

      <section className="dashboard__search">
        <label className="dashboard__label" htmlFor="plane-search">
          Search & select plane
        </label>
        <input
          id="plane-search"
          type="text"
          placeholder="Search by flight number, origin, destination, or aircraft model…"
          className="dashboard__input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-describedby="plane-search-hint"
        />
        <p id="plane-search-hint" className="dashboard__hint">
          Filter by flight number, airport code, or aircraft model.
        </p>
      </section>

      <div className="dashboard__filter-row">
        <div className="dashboard__filter-tabs" role="tablist" aria-label="Time filter">
          <button
            type="button"
            role="tab"
            aria-selected={timeFilter === '1-hour'}
            aria-controls="flights-panel"
            id="tab-1-hour"
            className={`dashboard__filter-tab ${timeFilter === '1-hour' ? 'dashboard__filter-tab--active' : ''}`}
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
            className={`dashboard__filter-tab ${timeFilter === '12-hours' ? 'dashboard__filter-tab--active' : ''}`}
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
            className={`dashboard__filter-tab ${timeFilter === 'all' ? 'dashboard__filter-tab--active' : ''}`}
            onClick={() => setTimeFilter('all')}
          >
            All
          </button>
        </div>
        <div className="dashboard__sort-wrap" ref={sortRef}>
          <button
            type="button"
            className="dashboard__sort-btn"
            onClick={(e) => { e.stopPropagation(); setSortOpen((o) => !o) }}
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            aria-label="Sort and filter"
          >
            <svg className="dashboard__sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="14" x2="14" y2="14" />
              <line x1="4" y1="20" x2="10" y2="20" />
            </svg>
            <span>Sort</span>
          </button>
          {sortOpen && (
            <ul className="dashboard__sort-dropdown" role="listbox" tabIndex={-1}>
              {SORT_OPTIONS.map((opt) => (
                <li key={opt.value} role="option" aria-selected={sortBy === opt.value}>
                  <button
                    type="button"
                    className={`dashboard__sort-opt ${sortBy === opt.value ? 'dashboard__sort-opt--active' : ''}`}
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
        <div className="dashboard__error-banner" role="alert">
          Flight Engine unavailable. Check Render URL or proxy.
        </div>
      )}

      {loading && <p className="dashboard__loading">Loading flights…</p>}

      {!loading && !error && (
        <div id="flights-panel" className="dashboard__flights-grid" role="list">
          {filtered.map((f) => (
            <button
              key={`${f.flightNumber}-${f.origin.code}-${f.destination.code}-${f.departureTime}`}
              type="button"
              role="listitem"
              className={`dashboard__flights-tile ${selectedFlight === f ? 'dashboard__flights-tile--selected' : ''}`}
              onClick={() => setSelectedFlight(f)}
            >
              <span className="dashboard__flights-label">
                AA{f.flightNumber} · {f.origin.code} → {f.destination.code} · {f.aircraft.model}
              </span>
              <span className="dashboard__flights-secondary">
                {formatTime(f.departureTime)} – {formatTime(f.arrivalTime)}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedFlight && (
        <section className="dashboard__selected-card" aria-label="Selected flight">
          <h3 className="dashboard__selected-title">Selected flight</h3>
          <p className="dashboard__selected-label">
            AA{selectedFlight.flightNumber} · {selectedFlight.origin.code} → {selectedFlight.destination.code} · {selectedFlight.aircraft.model}
          </p>
          <p className="dashboard__selected-secondary">
            {formatTime(selectedFlight.departureTime)} – {formatTime(selectedFlight.arrivalTime)}
          </p>
        </section>
      )}

      <section className="dashboard__map" aria-label="Fleet map">
        <div className="dashboard__map-placeholder">
          <span className="dashboard__map-label">Fleet map</span>
          <p className="dashboard__map-desc">Map visualization coming soon.</p>
        </div>
      </section>
    </main>
  )
}
