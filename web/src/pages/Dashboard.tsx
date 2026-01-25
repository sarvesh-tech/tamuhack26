import { useState } from "react";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import type { Flight } from "../lib/flightEngine";
import { INSPECTION_STEPS } from "../constants/inspectionSteps";
import {
    useInspectionSession,
    type InspectionStepInstance,
} from "../hooks/useInspectionSession";
import { useInspectionPhotoUrl } from "../hooks/useInspectionPhotoUrl";
import { useActiveInspectionSessions } from "../hooks/useActiveInspectionSessions";
import { useFlightForInspection } from "../hooks/useFlightForInspection";
import { supabase } from "../lib/supabase";

type TabId = "overview" | "audit-logs" | "inspections";

const TABS: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "audit-logs", label: "Audit logs" },
    { id: "inspections", label: "Inspections" },
];

function ChecklistStepRow({
    stepId,
    title,
    status,
    photoPath,
    transcript,
    onClick,
}: {
    stepId: number;
    title: string;
    status: "pending" | "in_progress" | "completed" | "skipped";
    photoPath: string | null;
    transcript: string | null;
    onClick?: () => void;
}) {
    const { url } = useInspectionPhotoUrl(photoPath);
    return (
        <div
            className={`dashboard__checklist-item dashboard__checklist-item--${status} ${onClick ? "dashboard__checklist-item--clickable" : ""}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <span className="dashboard__checklist-item-num">{stepId}</span>
            <div className="dashboard__checklist-item-body">
                <div className="dashboard__checklist-item-title">{title}</div>
                <span className="dashboard__checklist-item-status">
                    {status.replace("_", " ")}
                </span>
                {status === "completed" && (photoPath || transcript) && (
                    <div className="dashboard__checklist-item-evidence">
                        {url && (
                            <img
                                src={url}
                                alt=""
                                className="dashboard__checklist-item-thumb"
                            />
                        )}
                        {transcript && (
                            <span className="dashboard__checklist-item-transcript">
                                {transcript}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function PerformStepModal({
    step,
    onClose,
    onUpdate,
}: {
    step: InspectionStepInstance;
    onClose: () => void;
    onUpdate: () => void;
}) {
    const [transcript, setTranscript] = useState(step.transcript || "");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleComplete = async () => {
        setLoading(true);
        try {
            let photoPath = step.photo_path;

            // Upload photo if new selected
            if (photoFile) {
                const ext = photoFile.name.split(".").pop();
                const path = `sessions/${step.session_id}/steps/${step.step_id}/${Date.now()}.${ext}`;
                const { error: upErr } = await supabase.storage
                    .from("inspection-evidence")
                    .upload(path, photoFile, { upsert: true });

                if (upErr) throw upErr;
                photoPath = path;
            }

            const { error } = await supabase
                .from("inspection_step_instances")
                .upsert(
                    {
                        id: step.id, // if id exists
                        session_id: step.session_id,
                        step_id: step.step_id,
                        title: step.title,
                        status: "completed",
                        completed_at: new Date().toISOString(),
                        photo_path: photoPath,
                        transcript: transcript,
                    },
                    { onConflict: "session_id, step_id" },
                );

            if (error) throw error;
            onUpdate();
            onClose();
        } catch (e) {
            alert("Error updating step");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from("inspection_step_instances")
                .upsert(
                    {
                        session_id: step.session_id,
                        step_id: step.step_id,
                        title: step.title,
                        status: "skipped",
                        completed_at: new Date().toISOString(),
                        // keep existing photo/transcript if any, or clear? Mobile currently clears/doesn't send.
                        // Let's keep them if they exist in DB, otherwise null.
                        // Actually upsert might overwrite. Mobile implementation overwrote with null.
                        photo_path: null,
                        transcript: null,
                    },
                    { onConflict: "session_id, step_id" },
                );

            if (error) throw error;
            onUpdate();
            onClose();
        } catch (e) {
            alert("Failed to skip");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal__backdrop" onClick={onClose} />
            <div className="modal__box">
                <div className="modal__head">
                    <h3 className="modal__title">{step.title}</h3>
                    <button
                        type="button"
                        className="modal__close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
                <div className="modal__body">
                    <div style={{ marginBottom: "1rem" }}>
                        <label
                            style={{
                                display: "block",
                                color: "#a1a1aa",
                                fontSize: "0.9rem",
                                marginBottom: "0.5rem",
                            }}
                        >
                            Photo Evidence
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            className="find-flight__input"
                            onChange={(e) =>
                                setPhotoFile(e.target.files?.[0] ?? null)
                            }
                        />
                        {step.photo_path && !photoFile && (
                            <p
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#71717a",
                                    marginTop: "0.5rem",
                                }}
                            >
                                Current photo exists. Uploading new one will
                                replace it.
                            </p>
                        )}
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                        <label
                            style={{
                                display: "block",
                                color: "#a1a1aa",
                                fontSize: "0.9rem",
                                marginBottom: "0.5rem",
                            }}
                        >
                            Notes / Transcript
                        </label>
                        <textarea
                            className="find-flight__input"
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            rows={3}
                            placeholder="Add observations..."
                            style={{ resize: "vertical" }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: "1rem" }}>
                        <button
                            className="dashboard__join-btn"
                            onClick={handleSkip}
                            disabled={loading}
                            style={{
                                flex: 1,
                                backgroundColor: "rgba(255,255,255,0.05)",
                                color: "#a1a1aa",
                                borderColor: "transparent",
                            }}
                        >
                            Skip
                        </button>
                        <button
                            className="dashboard__join-btn dashboard__join-btn--primary"
                            onClick={handleComplete}
                            disabled={loading}
                            style={{ flex: 2 }}
                        >
                            {loading ? "Saving…" : "Complete Step"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function mergeStep(
    step: (typeof INSPECTION_STEPS)[number],
    dbSteps: InspectionStepInstance[],
): {
    stepId: number;
    title: string;
    status: "pending" | "in_progress" | "completed" | "skipped";
    photoPath: string | null;
    transcript: string | null;
} {
    const db = dbSteps.find((s) => s.step_id === step.id);
    return {
        stepId: step.id,
        title: step.title,
        status: (db?.status ?? "pending") as
            | "pending"
            | "in_progress"
            | "completed"
            | "skipped",
        photoPath: db?.photo_path ?? null,
        transcript: db?.transcript ?? null,
    };
}

function formatStartedAt(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return "Just now";
    if (diffM < 60) return `${diffM} min ago`;
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function formatAuditTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffM = diffMs / 60000;
    const diffH = diffMs / 3600000;
    if (diffM < 1) return "Just now";
    if (diffM < 60) return `${Math.floor(diffM)}m ago`;
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function AuditLogRow({
    photoPath,
    user,
    description,
    timestamp,
}: {
    photoPath: string | null;
    user: string;
    description: string;
    timestamp: string;
}) {
    const { url } = useInspectionPhotoUrl(photoPath);
    const userTrunc = user.length > 24 ? user.slice(0, 24) + "…" : user;
    return (
        <div className="dashboard__audit-row">
            <div className="dashboard__audit-thumb-wrap">
                {url ? (
                    <img src={url} alt="" className="dashboard__audit-thumb" />
                ) : (
                    <span
                        className="dashboard__audit-thumb dashboard__audit-thumb--placeholder"
                        aria-hidden
                    />
                )}
            </div>
            <span className="dashboard__audit-user" title={user}>
                {userTrunc}
            </span>
            <span className="dashboard__audit-desc" title={description}>
                {description}
            </span>
            <span className="dashboard__audit-time">{timestamp}</span>
        </div>
    );
}

export function Dashboard() {
    const { state } = useLocation() as { state?: { flight: Flight } | null };
    const [searchParams, setSearchParams] = useSearchParams();
    const sessionId = searchParams.get("sessionId");
    const [activeTab, setActiveTab] = useState<TabId>("overview");
    const [editingStep, setEditingStep] =
        useState<InspectionStepInstance | null>(null);

    const { session, steps, loading, error, endSession, cancelSession } =
        useInspectionSession(sessionId);
    const { flight, loading: flightLoading } = useFlightForInspection(
        session,
        state?.flight ?? null,
    );
    const {
        sessions: activeSessions,
        loading: activeLoading,
        error: activeError,
    } = useActiveInspectionSessions(
        !sessionId,
        flight ? `AA${flight.flightNumber}` : null,
    );

    const lastUpdated = session?.updated_at
        ? new Date(session.updated_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—";

    const completedSteps = (steps ?? [])
        .filter((s) => s.status === "completed" && s.completed_at)
        .sort((a, b) =>
            (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
        );

    const handleStartSession = async () => {
        if (!flight) return;
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Close other active sessions for this user
        await supabase
            .from("inspection_sessions")
            .update({ status: "completed", ended_at: new Date().toISOString() })
            .eq("inspector_id", user.id)
            .eq("status", "active");

        const { data, error } = await supabase
            .from("inspection_sessions")
            .insert({
                inspector_id: user.id, // Keep this for record but filtering is now broader
                inspector_email: user.email,
                inspector_name: user.user_metadata?.full_name || user.email,
                flight_number: `AA${flight.flightNumber}`,
                status: "active",
                started_at: new Date().toISOString(),
                total_steps: INSPECTION_STEPS.length,
                steps_completed: 0,
                progress_pct: 0,
            })
            .select()
            .single();

        if (error) {
            console.error(error);
            alert("Failed to start session");
            return;
        }

        setSearchParams({ sessionId: data.id });
    };

    const handleEndSession = async () => {
        if (confirm("Are you sure you want to end this inspection?")) {
            await endSession();
        }
    };

    const handleCancelSession = async () => {
        if (
            confirm(
                "Are you sure you want to cancel this inspection? This cannot be undone.",
            )
        ) {
            await cancelSession();
        }
    };

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
                            className={`dashboard__nav-link ${activeTab === tab.id ? "dashboard__nav-link--active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
                <div style={{ padding: "1rem" }}>
                    <Link
                        to="/find-flight"
                        className="dashboard__nav-link"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginTop: "auto",
                        }}
                    >
                        <span>←</span> Back to Flights
                    </Link>
                </div>
            </aside>
            <main className="dashboard__main">
                <div className="dashboard__flight-info">
                    <img
                        src="/aalogo.png"
                        alt=""
                        className="dashboard__flight-logo"
                        aria-hidden
                    />
                    <div className="dashboard__flight-info-body">
                        <h1 className="dashboard__flight-number">
                            {flight ? `AA${flight.flightNumber}` : "—"}
                        </h1>
                        <p className="dashboard__flight-route">
                            {flightLoading && !flight
                                ? "Loading…"
                                : flight
                                  ? `${flight.origin.city} (${flight.origin.code}) → ${flight.destination.city} (${flight.destination.code})`
                                  : "From — to —"}
                        </p>
                        {!flight && !flightLoading && (
                            <p className="dashboard__flight-hint">
                                <Link to="/find-flight">Select a flight</Link>{" "}
                                and click Continue to view the dashboard.
                            </p>
                        )}
                    </div>
                </div>
                {activeTab === "overview" ? (
                    <div className="dashboard__overview-wrap">
                        <section
                            className="dashboard__seats-section"
                            aria-label="Inspection checklist"
                        >
                            <div className="dashboard__checklist">
                                <div className="dashboard__checklist-head">
                                    <h2 className="dashboard__checklist-title">
                                        Preflight Checklist
                                    </h2>
                                </div>

                                {!sessionId && (
                                    <>
                                        {activeLoading &&
                                            activeSessions.length === 0 && (
                                                <p className="dashboard__checklist-empty">
                                                    Loading…
                                                </p>
                                            )}
                                        {activeError && (
                                            <p
                                                className="dashboard__checklist-empty"
                                                style={{ color: "#fca5a5" }}
                                            >
                                                {activeError}
                                            </p>
                                        )}
                                        {!activeLoading &&
                                            activeSessions.length === 0 && (
                                                <>
                                                    <p className="dashboard__checklist-empty">
                                                        No inspection in
                                                        progress.
                                                    </p>
                                                    {flight && (
                                                        <button
                                                            type="button"
                                                            className="dashboard__join-btn dashboard__join-btn--primary"
                                                            onClick={
                                                                handleStartSession
                                                            }
                                                            style={{
                                                                margin: "1rem auto",
                                                                display:
                                                                    "block",
                                                            }}
                                                        >
                                                            Start New Inspection
                                                        </button>
                                                    )}
                                                    <p className="dashboard__checklist-recent">
                                                        Viewing flight{" "}
                                                        {flight
                                                            ? `AA${flight.flightNumber}`
                                                            : "..."}
                                                    </p>
                                                </>
                                            )}
                                        {activeSessions.length >= 1 && (
                                            <div className="dashboard__checklist-live">
                                                {activeSessions.length ===
                                                    1 && (
                                                    <button
                                                        type="button"
                                                        className="dashboard__join-btn dashboard__join-btn--primary"
                                                        onClick={() =>
                                                            setSearchParams({
                                                                sessionId:
                                                                    activeSessions[0]
                                                                        .id,
                                                            })
                                                        }
                                                    >
                                                        Join live inspection
                                                    </button>
                                                )}
                                                <p className="dashboard__checklist-live-title">
                                                    Live inspections
                                                </p>
                                                <ul className="dashboard__checklist-live-list">
                                                    {activeSessions.map((s) => (
                                                        <li
                                                            key={s.id}
                                                            className="dashboard__checklist-live-item"
                                                        >
                                                            <span className="dashboard__checklist-live-meta">
                                                                {formatStartedAt(
                                                                    s.started_at,
                                                                )}{" "}
                                                                ·{" "}
                                                                {s.progress_pct}
                                                                %
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="dashboard__join-btn"
                                                                onClick={() =>
                                                                    setSearchParams(
                                                                        {
                                                                            sessionId:
                                                                                s.id,
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                Join live
                                                                inspection
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                )}

                                {sessionId && loading && (
                                    <p className="dashboard__checklist-empty">
                                        Loading…
                                    </p>
                                )}

                                {sessionId && error && (
                                    <p
                                        className="dashboard__checklist-empty"
                                        style={{ color: "#fca5a5" }}
                                    >
                                        {error}
                                    </p>
                                )}

                                {sessionId && session && (
                                    <div className="dashboard__checklist-list">
                                        {INSPECTION_STEPS.map((step) => {
                                            const m = mergeStep(step, steps);
                                            return (
                                                <ChecklistStepRow
                                                    key={step.id}
                                                    stepId={m.stepId}
                                                    title={m.title}
                                                    status={m.status}
                                                    photoPath={m.photoPath}
                                                    transcript={m.transcript}
                                                    onClick={
                                                        m.status ===
                                                            "completed" ||
                                                        m.status ===
                                                            "skipped" ||
                                                        m.status ===
                                                            "pending" ||
                                                        m.status ===
                                                            "in_progress"
                                                            ? () => {
                                                                  // Need the full DB object including session_id
                                                                  // If in local steps array, use it. If not (pending), construct a partial one.
                                                                  let db =
                                                                      steps.find(
                                                                          (s) =>
                                                                              s.step_id ===
                                                                              step.id,
                                                                      );
                                                                  if (!db) {
                                                                      db = {
                                                                          id:
                                                                              "temp-" +
                                                                              step.id, // Only works if we upsert by session_id, step_id
                                                                          session_id:
                                                                              sessionId,
                                                                          step_id:
                                                                              step.id,
                                                                          title: step.title,
                                                                          status: "pending",
                                                                          started_at:
                                                                              null,
                                                                          completed_at:
                                                                              null,
                                                                          photo_path:
                                                                              null,
                                                                          transcript:
                                                                              null,
                                                                      };
                                                                  }
                                                                  setEditingStep(
                                                                      db,
                                                                  );
                                                              }
                                                            : undefined
                                                    }
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>

                        {editingStep && (
                            <PerformStepModal
                                step={editingStep}
                                onClose={() => setEditingStep(null)}
                                // Changes are handled internally in modal now, but we might want to force a refresh if channels don't catch it fast enough?
                                // Currently channel subscription handles 'postgres_changes', so it should auto-update.
                                // We passed onUpdate just in case logic needs it, but we can leave it empty or trigger something.
                                onUpdate={() => {}}
                            />
                        )}

                        <aside
                            className="dashboard__progress-panel"
                            aria-label="Inspection progress"
                        >
                            <div className="dashboard__progress-header">
                                <h2 className="dashboard__progress-panel-title">
                                    Inspection Progress
                                </h2>
                                <span className="dashboard__progress-badge">
                                    {session
                                        ? `${session.progress_pct}%`
                                        : "0%"}{" "}
                                    Complete
                                </span>
                            </div>

                            <div className="dashboard__progress-stat-card dashboard__progress-stat-card--primary">
                                <div className="dashboard__progress-stat-icon">
                                    ✓
                                </div>
                                <div className="dashboard__progress-stat-content">
                                    <div className="dashboard__progress-stat-value">
                                        {session?.steps_completed ?? 0}
                                        <span className="dashboard__progress-stat-total">
                                            /{session?.total_steps ?? 12}
                                        </span>
                                    </div>
                                    <div className="dashboard__progress-stat-label">
                                        Steps Completed
                                    </div>
                                </div>
                            </div>

                            <div className="dashboard__progress-bar-container">
                                <div className="dashboard__progress-bar-label">
                                    Overall Progress
                                </div>
                                <div
                                    className="dashboard__progress-bar"
                                    role="progressbar"
                                    aria-valuenow={session?.progress_pct ?? 0}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    <div
                                        className="dashboard__progress-bar-fill"
                                        style={{
                                            width: `${session?.progress_pct ?? 0}%`,
                                        }}
                                    />
                                </div>
                                <div className="dashboard__progress-bar-text">
                                    {session?.progress_pct ?? 0}%
                                </div>
                            </div>

                            <div className="dashboard__progress-footer">
                                <svg
                                    className="dashboard__progress-footer-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>Updated {lastUpdated}</span>
                            </div>

                            {session && session.status === "active" && (
                                <div className="dashboard__progress-actions">
                                    <button
                                        type="button"
                                        className="dashboard__action-btn dashboard__action-btn--complete"
                                        onClick={handleEndSession}
                                    >
                                        Complete Inspection
                                    </button>
                                    <button
                                        type="button"
                                        className="dashboard__action-btn dashboard__action-btn--cancel"
                                        onClick={handleCancelSession}
                                    >
                                        Cancel Inspection
                                    </button>
                                </div>
                            )}
                        </aside>
                    </div>
                ) : (
                    <>
                        {activeTab === "audit-logs" && (
                            <section
                                className="dashboard__panel"
                                aria-label="Audit logs"
                            >
                                <h2 className="dashboard__panel-title">
                                    Audit logs
                                </h2>
                                {!sessionId && (
                                    <p className="dashboard__panel-empty">
                                        Select an inspection to view audit logs.
                                    </p>
                                )}
                                {sessionId && loading && (
                                    <p className="dashboard__panel-empty">
                                        Loading…
                                    </p>
                                )}
                                {sessionId && error && (
                                    <p
                                        className="dashboard__panel-empty"
                                        style={{ color: "#fca5a5" }}
                                    >
                                        {error}
                                    </p>
                                )}
                                {sessionId &&
                                    session &&
                                    completedSteps.length === 0 && (
                                        <p className="dashboard__panel-empty">
                                            No completed steps yet. Complete
                                            steps on the mobile app to see
                                            entries.
                                        </p>
                                    )}
                                {sessionId &&
                                    session &&
                                    completedSteps.length >= 1 && (
                                        <div className="dashboard__audit-list">
                                            {completedSteps.map((step) => {
                                                const desc = step.transcript
                                                    ? `${step.title} — ${step.transcript.slice(0, 50)}${step.transcript.length > 50 ? "…" : ""}`
                                                    : step.title;
                                                return (
                                                    <AuditLogRow
                                                        key={step.id}
                                                        photoPath={
                                                            step.photo_path
                                                        }
                                                        user={
                                                            session.inspector_name ||
                                                            session.inspector_email ||
                                                            "Inspector"
                                                        }
                                                        description={desc}
                                                        timestamp={formatAuditTime(
                                                            step.completed_at,
                                                        )}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                            </section>
                        )}
                        {activeTab === "inspections" && (
                            <section
                                className="dashboard__panel"
                                aria-label="Inspections"
                            >
                                <h2 className="dashboard__panel-title">
                                    Inspections
                                </h2>
                                <p className="dashboard__panel-empty">
                                    Inspection records will appear here.
                                </p>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
