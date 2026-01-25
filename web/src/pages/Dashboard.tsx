import { useState, useEffect } from "react";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import type { Flight } from "../lib/flightEngine";
import { INSPECTION_STEPS, type Role } from "../constants/inspectionSteps";
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

// Basic SpeechRecognition type
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}
interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}
interface SpeechRecognitionErrorEvent {
  error: string;
}
declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

function WebcamCapture({ onCapture, onCancel }: { onCapture: (file: File) => void, onCancel: () => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = (el: HTMLVideoElement | null) => {
    if (el && stream) el.srcObject = stream;
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(setStream)
      .catch(err => {
        console.error("Camera error:", err);
        alert("Could not access camera. Please check permissions.");
        onCancel();
      });
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  const capture = () => {
    const video = document.querySelector('video');
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      }
    }, 'image/jpeg', 0.8);
  };

  return (
    <div className="webcam-modal" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '500px', backgroundColor: '#18181b', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <video autoPlay playsInline ref={videoRef} style={{ width: '100%', display: 'block' }} />
        <div style={{ padding: '20px', display: 'flex', gap: '10px' }}>
          <button className="dashboard__join-btn" onClick={onCancel} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cancel</button>
          <button className="dashboard__join-btn dashboard__join-btn--primary" onClick={capture} style={{ flex: 2, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Take Photo</button>
        </div>
      </div>
    </div>
  );
}

function ChecklistAccordionRow({
  step,
  dbStep,
  sessionId,
  expanded,
  onToggle,
  onUpdate
}: {
  step: (typeof INSPECTION_STEPS)[number]
  dbStep: InspectionStepInstance | undefined
  sessionId: string
  expanded: boolean
  onToggle: () => void
  onUpdate: () => void
}) {
  const status = (dbStep?.status ?? 'pending') as 'pending' | 'in_progress' | 'completed' | 'skipped'
  const [transcript, setTranscript] = useState(dbStep?.transcript || '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const { url } = useInspectionPhotoUrl(dbStep?.photo_path ?? null)

  // Sync prop changes to local state when expanded
  useEffect(() => {
    if (expanded && dbStep) {
      setTranscript(dbStep.transcript || '')
    }
  }, [expanded, dbStep])

  // AI simulation removed for MVP - database columns not yet available

  const handleSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript((prev) => prev ? prev + ' ' + text : text);
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech error', event.error);
      setListening(false);
    };

    setListening(true);
    recognition.start();
  }

  const handleUpdate = async (newStatus: 'completed' | 'skipped') => {
    setLoading(true)
    try {
      let photoPath = dbStep?.photo_path ?? null

      if (photoFile && photoFile.name) {
        const ext = photoFile.name.split('.').pop()
        const path = `sessions/${sessionId}/steps/${step.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('inspection-evidence')
          .upload(path, photoFile, { upsert: true })
        if (upErr) {
          console.warn('Photo upload failed:', upErr)
          // Continue anyway for MVP demo
        } else {
          photoPath = path
        }
      }

      let ai_severity = 'none'
      let ai_analysis = null

      console.log('[Dashboard] ===== AI ANALYSIS START =====')
      console.log('[Dashboard] Step title:', step.title)
      console.log('[Dashboard] Transcript:', transcript)
      
      try {
        console.log('[Dashboard] Calling OpenAI directly...')
        
        const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
        
        if (!OPENAI_API_KEY) {
          console.warn('[Dashboard] OPENAI_API_KEY not configured, skipping AI analysis')
        } else {
          const prompt = `You are an airline safety inspector. Analyze the following preflight inspection task and the inspector's notes.
Deduce the severity level of any issues found. BE VERY SENSITIVE to any language suggesting problems, even if mixed with positive statements.

TASK: "${step.title}"
NOTES: "${transcript || "No notes provided"}"

Respond in strict JSON format with two fields:
- "severity": one of ["low", "medium", "high", "none"]
  - "high": ANY mention of death, danger, missing equipment, broken items, failure, critical problems, sarcasm about safety, or anything that suggests the flight should not depart. Examples: "people are going to die", "extinguisher missing", "door won't seal", "hydraulic leak".
  - "medium": Concerns, hesitations, incomplete checks, unprofessional notes, or anything suspicious. Examples: "not sure", "might be an issue", "hello" as a note (inappropriate), "I guess it's fine".
  - "low": Minor observations, trivial notes, or routine findings with no safety concern.
  - "none": ONLY use if the notes explicitly confirm everything is correct with positive language like "checked", "verified", "good", "all clear", "operational", "armed correctly".
- "analysis": A brief, one-sentence professional summary. If there's a problem, describe it clearly.

IMPORTANT: If ANY part of the notes suggests a problem or concern, classify it as at least "medium". Do NOT default to "none" or "low" when there are red flags.`

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0,
              response_format: { type: 'json_object' }
            })
          })
          
          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
          }
          
          const data = await response.json()
          console.log('[Dashboard] OpenAI response:', data)
          
          const result = JSON.parse(data.choices[0].message.content)
          ai_severity = result.severity || 'none'
          ai_analysis = result.analysis || null
          console.log('[Dashboard] Parsed AI result:', { severity: ai_severity, analysis: ai_analysis })
        }
      } catch (e) {
        console.error('[Dashboard] AI analysis exception:', e)
      }
      
      console.log('[Dashboard] Final AI values being saved:', { ai_severity, ai_analysis })
      console.log('[Dashboard] ===== AI ANALYSIS END =====')

      const { error } = await supabase
        .from('inspection_step_instances')
        .upsert({
          id: dbStep?.id, // Use existing ID to guarantee update over insertion
          session_id: sessionId,
          step_id: step.id,
          title: step.title,
          status: newStatus,
          completed_at: new Date().toISOString(),
          photo_path: photoPath,
          transcript: transcript || null,
          ai_severity,
          ai_analysis
        }, { onConflict: 'id' })

      if (error) throw error
      console.log(`[Dashboard] Step ${step.id} updated successfully to ${newStatus}`);
      onUpdate()
      onToggle()
    } catch (e: any) {
      console.error('[Dashboard] Step Update Failure:', e);
      alert(`Failed to update step: ${e.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`dashboard__checklist-item dashboard__checklist-item--${status} ${expanded ? 'dashboard__checklist-item--expanded' : ''}`}>
      <div
        className="dashboard__checklist-item-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
      >
        <span className="dashboard__checklist-item-num">{step.id}</span>
        <div className="dashboard__checklist-item-body-text">
          <div className="dashboard__checklist-item-title">
            {step.title}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="dashboard__checklist-item-status">{status.replace('_', ' ')}</span>
            {dbStep?.completed_by && (status === 'completed' || status === 'skipped') && (
              <span style={{ fontSize: '0.7rem', color: '#71717a', fontStyle: 'italic' }}>
                - by Inspector {dbStep.completed_by.slice(0, 4)}...
              </span>
            )}
          </div>
        </div>
        <span className="dashboard__checklist-arrow">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="dashboard__checklist-item-content">
          <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', width: '100%' }}>

            {/* Read-Only or Edit View */}
            {(status === 'completed' || status === 'skipped') && !photoFile ? (
              <div className="dashboard__checklist-evidence-view">
                {url && <img src={url} alt="" className="dashboard__checklist-item-thumb-large" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 12 }} />}
                {dbStep?.transcript && <p className="dashboard__checklist-transcript-text">{dbStep.transcript}</p>}
                <button
                  className="dashboard__join-btn"
                  onClick={() => setPhotoFile({} as any)} // Hack to trigger edit mode visual or just use a state 'isEditing'
                  style={{ marginTop: 12, backgroundColor: '#27272a' }}
                >
                  Edit Evidence / Status
                </button>
              </div>
            ) : (
              <div className="dashboard__checklist-form">
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <label className="dashboard__join-btn" style={{ flex: 1, minWidth: '120px', cursor: 'pointer', textAlign: 'center', backgroundColor: photoFile && !showCamera ? '#22c55e' : 'rgba(255,255,255,0.08)' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setPhotoFile(e.target.files?.[0] ?? null);
                        setShowCamera(false);
                      }}
                      style={{ display: 'none' }}
                    />
                    {photoFile && !showCamera ? 'File Selected' : '📁 Upload File'}
                  </label>

                  <button
                    type="button"
                    className="dashboard__join-btn"
                    onClick={() => setShowCamera(true)}
                    style={{ flex: 1, minWidth: '120px', backgroundColor: photoFile && showCamera ? '#22c55e' : 'rgba(255,255,255,0.08)' }}
                  >
                    {photoFile && showCamera ? 'Photo Captured' : '📷 Take Photo'}
                  </button>

                  <button
                    type="button"
                    className="dashboard__join-btn"
                    onClick={handleSpeech}
                    style={{ flex: '1 0 100%', backgroundColor: listening ? '#ef4444' : 'rgba(255,255,255,0.08)', animation: listening ? 'pulse 1s infinite' : 'none' }}
                  >
                    {listening ? 'Listening...' : '🎤 Dictate Notes'}
                  </button>
                </div>

                {showCamera && (
                  <WebcamCapture
                    onCapture={(file) => {
                      setPhotoFile(file);
                      setShowCamera(false);
                    }}
                    onCancel={() => setShowCamera(false)}
                  />
                )}

                {photoFile && <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '1rem', textAlign: 'center' }}>Ready to upload: {photoFile.name}</p>}

                <textarea
                  className="find-flight__input"
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Notes will appear here..."
                  style={{ marginBottom: '1rem', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    className="dashboard__join-btn"
                    disabled={loading}
                    onClick={() => handleUpdate('skipped')}
                    style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', color: '#fbbf24', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    Skip
                  </button>
                  <button
                    className="dashboard__join-btn dashboard__join-btn--primary"
                    disabled={loading}
                    onClick={() => handleUpdate('completed')}
                    style={{ flex: 2, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {loading ? 'Saving...' : 'Complete Step'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
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
  severity,
  analysis
}: {
  photoPath: string | null;
  user: string;
  description: string;
  timestamp: string;
  severity?: string | null;
  analysis?: string | null;
}) {
  const { url } = useInspectionPhotoUrl(photoPath);
  const userTrunc = user.length > 24 ? user.slice(0, 24) + "…" : user;

  const badgeClass = severity === 'high' ? 'badge--high' :
    severity === 'medium' ? 'badge--medium' :
      (severity === 'low' || severity === 'none') ? 'badge--low' : '';

  const badgeLabel = severity === 'high' ? 'HIGH PRIORITY' :
    severity === 'medium' ? 'WARNING' :
      (severity === 'low' || severity === 'none') ? 'FUNCTIONAL' : '';

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
      <div className="dashboard__audit-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <span className="dashboard__audit-user" title={user}>{userTrunc}</span>
          {badgeLabel && <span className={`badge ${badgeClass}`}>{badgeLabel}</span>}
        </div>
        <span className="dashboard__audit-desc" title={description}>{description}</span>
        {analysis && <p style={{ fontSize: '0.75rem', color: '#71717a', fontStyle: 'italic', marginTop: '0.25rem' }}>AI: {analysis}</p>}
      </div>
      <span className="dashboard__audit-time">{timestamp}</span>
    </div>
  );
}

export function Dashboard() {
  const { state } = useLocation() as { state?: { flight: Flight } | null };
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editingStep, setEditingStep] = useState<InspectionStepInstance | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    // Fetch user role
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (data?.role) setUserRole(data.role as Role)
    })
  }, [])

  const changeRole = async (newRole: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({ id: user.id, role: newRole })
      setUserRole(newRole as Role)
    }
  }

  const { session, steps, loading, error, endSession, cancelSession, refresh, progressPct } =
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

  const displayProgressPct = progressPct;

  const lastUpdated = session?.updated_at
    ? new Date(session.updated_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "—";

  const completedSteps = (steps ?? [])
    .filter((s) => (s.status === "completed" || s.status === "skipped") && s.completed_at)
    .sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
    );

  const handleStartSession = async () => {
    if (!flight) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Check for ANY active session for this flight (collaborative check)
    const { data: existingSession } = await supabase
      .from("inspection_sessions")
      .select("id")
      .eq("flight_number", `AA${flight.flightNumber}`)
      .eq("status", "active")
      .maybeSingle();

    if (existingSession) {
      console.log("Found existing active session, joining...", existingSession.id);
      setSearchParams({ sessionId: existingSession.id });
      return;
    }

    // Close other active sessions for THIS user (cleanup legacy personal sessions)
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
      // If error is unique constraint violation (race condition), just retry/find.
      if (error.code === '23505') { // unique_violation
        alert("A session was just started by someone else. Please refresh to join.");
      } else {
        alert("Failed to start session");
      }
      return;
    }

    // Initialize all steps as pending in the DB for accurate progress tracking
    const { error: stepsErr } = await supabase
      .from('inspection_step_instances')
      .insert(INSPECTION_STEPS.map((s) => ({
        session_id: data.id,
        step_id: s.id,
        title: s.title,
        status: 'pending'
      })));

    if (stepsErr) {
      console.error("Failed to initialize steps:", stepsErr);
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
          {userRole && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: '0.8rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>Role: <strong style={{ color: '#fafafa' }}>{userRole}</strong></p>
              <button className="find-flight__detail-back" style={{ fontSize: '0.75rem' }} onClick={() => setUserRole(null)}>Change</button>
            </div>
          )}
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
                  <>
                    {!userRole && (
                      <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: '#fafafa' }}>Please Select Your Role</h3>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {['Pilot', 'Flight Attendant', 'Mechanic', 'Ground Crew'].map(r => (
                            <button
                              key={r}
                              className="dashboard__join-btn"
                              onClick={() => changeRole(r)}
                              style={{ background: 'rgba(255,255,255,0.1)' }}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="dashboard__checklist-list">
                      {INSPECTION_STEPS.filter(s => !userRole || !s.allowedRoles || (s.allowedRoles as any).includes(userRole)).map((step) => {
                        const dbStep = steps.find(s => s.step_id === step.id)
                        return (
                          <ChecklistAccordionRow
                            key={step.id}
                            step={step}
                            dbStep={dbStep}
                            sessionId={sessionId}
                            expanded={editingStep?.step_id === step.id} // Reusing editingStep state to track expansion
                            onToggle={() => setEditingStep(editingStep?.step_id === step.id ? null : { step_id: step.id } as any)}
                            onUpdate={() => {
                              console.log("[Dashboard] onUpdate called, refreshing...");
                              refresh();
                            }} // Auto-updates via hook, but refresh for immediate UI sync
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>



            <aside
              className="dashboard__progress-panel"
              aria-label="Inspection progress"
            >
              <div className="dashboard__progress-header">
                <h2 className="dashboard__progress-panel-title">
                  Flight Status
                </h2>

                {/* Discord-style Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: '8px' }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: displayProgressPct === 100 ? '#22c55e' :
                      displayProgressPct > 60 ? '#f59e0b' : '#ef4444',
                    boxShadow: displayProgressPct === 100 ? '0 0 8px #22c55e' : 'none'
                  }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fafafa' }}>
                    {displayProgressPct === 100 ? "Ready to Fly" :
                      displayProgressPct > 80 ? "Ready for Pushback" :
                        displayProgressPct > 50 ? "Final Checks" :
                          displayProgressPct > 20 ? "Boarding" : "Cabin Prep"}
                  </span>
                </div>
                <span className="dashboard__progress-badge">
                  {displayProgressPct}% Complete
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
                            severity={step.ai_severity}
                            analysis={step.ai_analysis}
                          />
                        );
                      })}
                    </div>
                  )}
              </section>
            )}
            {activeTab === "inspections" && (
              <>
                {!sessionId && (
                  <section
                    className="dashboard__panel"
                    aria-label="Inspections"
                  >
                    <h2 className="dashboard__panel-title">
                      Inspections
                    </h2>
                    <p className="dashboard__panel-empty">
                      Select an inspection to view status.
                    </p>
                  </section>
                )}
                {sessionId && (
                  <section className="status-dashboard" style={{ padding: '0 2rem', marginTop: '1rem' }}>
                    <div className={`status-banner ${displayProgressPct === 100 ? 'status-banner--operational' :
                      displayProgressPct > 0 ? 'status-banner--info' : 'status-banner--info'
                      }`}>
                      <span>
                        {displayProgressPct === 100 ? 'All Systems Operational' :
                          displayProgressPct > 80 ? 'Ready for Pushback' :
                            displayProgressPct > 50 ? 'Final Safety Checks in Progress' :
                              displayProgressPct > 20 ? 'Boarding in Progress' : 'Initial Cabin Preparation'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="nav__active-dot" style={{ backgroundColor: displayProgressPct === 100 ? '#4ade80' : '#60a5fa' }} />
                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Live Inspection Status</span>
                      </div>
                    </div>

                    {[
                      { name: 'Emergency & Safety Systems', range: [1, 4] },
                      { name: 'Cabin Readiness & Configuration', range: [5, 7] },
                      { name: 'Structural Integrity & Galleys', range: [8, 10] },
                      { name: 'Flight Deck Communication', range: [11, 15] }
                    ].map((cat) => {
                      const catSteps = steps.filter(s => s.step_id >= cat.range[0] && s.step_id <= cat.range[1]);
                      const completedCount = catSteps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
                      const totalCount = cat.range[1] - cat.range[0] + 1;
                      const isOperational = completedCount === totalCount;

                      return (
                        <div key={cat.name} className="system-row">
                          <div className="system-row__header">
                            <span className="system-row__name">{cat.name}</span>
                            <span className={`system-row__status ${isOperational ? 'system-row__status--operational' : 'system-row__status--pending'}`}>
                              {isOperational ? 'Operational' : `${completedCount}/${totalCount} Verified`}
                            </span>
                          </div>
                          <div className="uptime-bar">
                            {Array.from({ length: totalCount }).map((_, i) => {
                              const stepId = cat.range[0] + i;
                              const step = steps.find(s => s.step_id === stepId);
                              const statusClass = step?.status === 'completed' ? 'uptime-bar__segment--complete' :
                                step?.status === 'skipped' ? 'uptime-bar__segment--skipped' :
                                  'uptime-bar__segment--pending';
                              return <div key={i} className={`uptime-bar__segment ${statusClass}`} title={step?.title || `Step ${stepId}`} />;
                            })}
                          </div>
                          <div className="uptime-legend">
                            <span>Inspection Start</span>
                            <span>100% Prepared</span>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
