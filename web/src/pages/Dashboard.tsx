import { useState } from 'react'
import { useLocation, Link, useSearchParams } from 'react-router-dom'
import type { Flight } from '../lib/flightEngine'
import { INSPECTION_STEPS } from '../constants/inspectionSteps'
import { useInspectionSession, type InspectionStepInstance } from '../hooks/useInspectionSession'
import { useInspectionPhotoUrl } from '../hooks/useInspectionPhotoUrl'
import { useActiveInspectionSessions } from '../hooks/useActiveInspectionSessions'

type TabId = 'overview' | 'audit-logs' | 'inspections'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit-logs', label: 'Audit logs' },
  { id: 'inspections', label: 'Inspections' },
]

function ChecklistStepRow({
  stepId,
  title,
  status,
  photoPath,
  transcript,
}: {
  stepId: number
  title: string
  status: 'pending' | 'in_progress' | 'completed'
  photoPath: string | null
  transcript: string | null
}) {
  const { url } = useInspectionPhotoUrl(photoPath)
  return (
    <div className={`dashboard__checklist-item dashboard__checklist-item--${status}`}>
      <span className="dashboard__checklist-item-num">{stepId}</span>
      <div className="dashboard__checklist-item-body">
        <div className="dashboard__checklist-item-title">{title}</div>
        <span className="dashboard__checklist-item-status">{status.replace('_', ' ')}</span>
        {status === 'completed' && (photoPath || transcript) && (
          <div className="dashboard__checklist-item-evidence">
            {url && <img src={url} alt="" className="dashboard__checklist-item-thumb" />}
            {transcript && <span className="dashboard__checklist-item-transcript">{transcript}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function mergeStep(
  step: (typeof INSPECTION_STEPS)[number],
  dbSteps: InspectionStepInstance[]
): { stepId: number; title: string; status: 'pending' | 'in_progress' | 'completed'; photoPath: string | null; transcript: string | null } {
  const db = dbSteps.find((s) => s.step_id === step.id)
  return {
    stepId: step.id,
    title: step.title,
    status: (db?.status ?? 'pending') as 'pending' | 'in_progress' | 'completed',
    photoPath: db?.photo_path ?? null,
    transcript: db?.transcript ?? null,
  }
}

function formatStartedAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM} min ago`
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

export function Dashboard() {
  const { state } = useLocation() as { state?: { flight: Flight } | null }
  const [searchParams, setSearchParams] = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const flight = state?.flight ?? null
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const { session, steps, loading, error } = useInspectionSession(sessionId)
  const { sessions: activeSessions, loading: activeLoading, error: activeError } = useActiveInspectionSessions(!sessionId)

  const lastUpdated = session?.updated_at
    ? new Date(session.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—'

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
            <section className="dashboard__seats-section" aria-label="Inspection checklist">
              <div className="dashboard__checklist">
                <div className="dashboard__checklist-head">
                  <h2 className="dashboard__checklist-title">Preflight Checklist</h2>
                </div>

                {!sessionId && (
                  <>
                    {activeLoading && activeSessions.length === 0 && (
                      <p className="dashboard__checklist-empty">Loading…</p>
                    )}
                    {activeError && (
                      <p className="dashboard__checklist-empty" style={{ color: '#fca5a5' }}>{activeError}</p>
                    )}
                    {!activeLoading && activeSessions.length === 0 && (
                      <>
                        <p className="dashboard__checklist-empty">No inspection selected.</p>
                        <p className="dashboard__checklist-empty">Waiting for an inspection to start…</p>
                        <p className="dashboard__checklist-recent">
                          Or add <code>?sessionId=...</code> to the URL.
                        </p>
                      </>
                    )}
                    {activeSessions.length >= 1 && (
                      <div className="dashboard__checklist-live">
                        {activeSessions.length === 1 && (
                          <button
                            type="button"
                            className="dashboard__join-btn dashboard__join-btn--primary"
                            onClick={() => setSearchParams({ sessionId: activeSessions[0].id })}
                          >
                            Join live inspection
                          </button>
                        )}
                        <p className="dashboard__checklist-live-title">Live inspections</p>
                        <ul className="dashboard__checklist-live-list">
                          {activeSessions.map((s) => (
                            <li key={s.id} className="dashboard__checklist-live-item">
                              <span className="dashboard__checklist-live-meta">
                                {formatStartedAt(s.started_at)} · {s.progress_pct}%
                              </span>
                              <button
                                type="button"
                                className="dashboard__join-btn"
                                onClick={() => setSearchParams({ sessionId: s.id })}
                              >
                                Join live inspection
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {sessionId && loading && <p className="dashboard__checklist-empty">Loading…</p>}

                {sessionId && error && <p className="dashboard__checklist-empty" style={{ color: '#fca5a5' }}>{error}</p>}

                {sessionId && session && (
                  <div className="dashboard__checklist-list">
                    {INSPECTION_STEPS.map((step) => {
                      const m = mergeStep(step, steps)
                      return (
                        <ChecklistStepRow
                          key={step.id}
                          stepId={m.stepId}
                          title={m.title}
                          status={m.status}
                          photoPath={m.photoPath}
                          transcript={m.transcript}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            <aside className="dashboard__progress-panel" aria-label="Inspection progress">
              <div className="dashboard__progress-header">
                <h2 className="dashboard__progress-panel-title">Inspection Progress</h2>
                <span className="dashboard__progress-badge">
                  {session ? `${session.progress_pct}%` : '0%'} Complete
                </span>
              </div>

              <div className="dashboard__progress-stat-card dashboard__progress-stat-card--primary">
                <div className="dashboard__progress-stat-icon">✓</div>
                <div className="dashboard__progress-stat-content">
                  <div className="dashboard__progress-stat-value">
                    {session?.steps_completed ?? 0}
                    <span className="dashboard__progress-stat-total">/{session?.total_steps ?? 12}</span>
                  </div>
                  <div className="dashboard__progress-stat-label">Steps Completed</div>
                </div>
              </div>

              <div className="dashboard__progress-bar-container">
                <div className="dashboard__progress-bar-label">Overall Progress</div>
                <div
                  className="dashboard__progress-bar"
                  role="progressbar"
                  aria-valuenow={session?.progress_pct ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="dashboard__progress-bar-fill"
                    style={{ width: `${session?.progress_pct ?? 0}%` }}
                  />
                </div>
                <div className="dashboard__progress-bar-text">{session?.progress_pct ?? 0}%</div>
              </div>

              <div className="dashboard__progress-footer">
                <svg className="dashboard__progress-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Updated {lastUpdated}</span>
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
