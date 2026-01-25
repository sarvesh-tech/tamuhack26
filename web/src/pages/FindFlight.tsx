import { useState, useMemo, useEffect, useRef } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import type { Flight } from "../lib/flightEngine";
import { supabase } from "../lib/supabase";
import { useFlights } from "../hooks/useFlights";

import { useActiveInspectionSessions } from "../hooks/useActiveInspectionSessions";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { RouteMap } from "../components/RouteMap";
import { PlaneModelViewer } from "../components/PlaneModelViewer";

type TimeFilter = "1-hour" | "12-hours" | "all";
type SortBy =
    | "departure"
    | "flightNumber"
    | "origin"
    | "destination"
    | "aircraft";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
    { value: "departure", label: "Departure time" },
    { value: "flightNumber", label: "Flight number" },
    { value: "origin", label: "Origin" },
    { value: "destination", label: "Destination" },
    { value: "aircraft", label: "Aircraft" },
];

function displayName(session: Session | null): string {
    if (!session?.user) return "there";
    const { user_metadata, email } = session.user;
    return (
        user_metadata?.full_name ??
        user_metadata?.name ??
        user_metadata?.user_name ??
        (email?.split("@")[0] || "there")
    );
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

function matchesSearch(flight: Flight, q: string): boolean {
    if (!q.trim()) return true;
    const lower = q.toLowerCase().trim();
    return (
        flight.flightNumber.toLowerCase().includes(lower) ||
        flight.origin.code.toLowerCase().includes(lower) ||
        flight.destination.code.toLowerCase().includes(lower) ||
        flight.aircraft.model.toLowerCase().includes(lower)
    );
}

function isWithin1Hour(flight: Flight): boolean {
    const now = Date.now();
    const dep = new Date(flight.departureTime).getTime();
    const oneHour = 60 * 60 * 1000;
    return dep >= now && dep <= now + oneHour;
}

function isWithin12Hours(flight: Flight): boolean {
    const now = Date.now();
    const dep = new Date(flight.departureTime).getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    return dep >= now && dep <= now + twelveHours;
}

function compareFlights(a: Flight, b: Flight, sortBy: SortBy): number {
    switch (sortBy) {
        case "departure":
            return (
                new Date(a.departureTime).getTime() -
                new Date(b.departureTime).getTime()
            );
        case "flightNumber":
            return a.flightNumber.localeCompare(b.flightNumber, undefined, {
                numeric: true,
            });
        case "origin":
            return a.origin.code.localeCompare(b.origin.code);
        case "destination":
            return a.destination.code.localeCompare(b.destination.code);
        case "aircraft":
            return a.aircraft.model.localeCompare(b.aircraft.model);
        default:
            return 0;
    }
}

type OutletContext = { session: Session | null };

const FILTERS: { id: TimeFilter; label: string }[] = [
    { id: "1-hour", label: "1 hour" },
    { id: "12-hours", label: "12 hours" },
    { id: "all", label: "All" },
];

export function FindFlight() {
    const { session } = useOutletContext<OutletContext>();
    const name = displayName(session);
    const { flights, loading, error } = useFlights({ date: undefined });
    const [search, setSearch] = useState("");
    const searchDebounced = useDebouncedValue(search, 200);
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("1-hour");
    const [sortBy, setSortBy] = useState<SortBy>("departure");
    const [sortOpen, setSortOpen] = useState(false);
    const [activeSessionsView, setActiveSessionsView] = useState(false);
    const [tick, setTick] = useState(0);
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);

    const { sessions: activeSessions } = useActiveInspectionSessions(
        !!selectedFlight,
        selectedFlight ? `AA${selectedFlight.flightNumber}` : null,
    );

    const { sessions: globalSessions, loading: globalLoading } =
        useActiveInspectionSessions(activeSessionsView, null, true);

    const [myFlights, setMyFlights] = useState<string[]>([]);

    // Refresh my flights
    const fetchMyFlights = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("user_flights")
            .select("flight_number")
            .eq("user_id", user.id);
        
        if (data && data.length > 0) {
            console.log("Found existing flights:", data.length)
            setMyFlights(data.map((d) => d.flight_number));
        } else if (!loading && flights.length > 0) {
            console.log("No existing flights, running Workday Simulation...")
            // Workday Simulation: Auto-assign NEXT 5 Upcoming flights to emulate shift
            // Sort by departure time (nearest first)
            const sorted = [...flights].sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
            
            // Ensure we pick future flights if possible, or just next available
            const now = new Date().getTime();
            const upcoming = sorted.filter(f => new Date(f.departureTime).getTime() > now);
            const candidates = upcoming.length >= 5 ? upcoming : sorted; // Fallback to any if not enough future
            const selected = candidates.slice(0, 5);
            
            const inserts = selected.map((f) => ({
                user_id: user.id,
                flight_number: `AA${f.flightNumber}`,
                selected_at: new Date().toISOString(),
            }));
            
            const { error } = await supabase.from("user_flights").insert(inserts);
            if (error) console.error("Workday Sim Insert Error:", error)
            else console.log("Workday Sim Assigned:", selected.length)
            
            setMyFlights(selected.map((f) => `AA${f.flightNumber}`));
        }
    };

    useEffect(() => {
        if (!loading) fetchMyFlights();
    }, [loading]);

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: { user } }) => {
            if (user) {
                setCurrentUserId(user.id);
                // Fetch Role from profiles table
                const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                if (error) console.error('Profile fetch error:', error)
                if (data?.role) setUserRole(data.role);
            }
            setRoleLoading(false);
        })
    }, [])

    const handleSetRole = async (role: string) => {
        if (!currentUserId) return;
        await supabase.from('profiles').upsert({ id: currentUserId, role });
        setUserRole(role);
    };

    const sortRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (timeFilter !== "1-hour") return;
        const id = setInterval(() => setTick((t) => t + 1), 60_000);
        return () => clearInterval(id);
    }, [timeFilter]);

    useEffect(() => {
        if (!sortOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node))
                setSortOpen(false);
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [sortOpen]);

    const filtered = useMemo(() => {
        let list = flights;
        if (timeFilter === "1-hour") list = list.filter(isWithin1Hour);
        else if (timeFilter === "12-hours") list = list.filter(isWithin12Hours);
        list = list.filter((f) => matchesSearch(f, searchDebounced));
        return [...list].sort((a, b) => compareFlights(a, b, sortBy));
    }, [flights, searchDebounced, timeFilter, sortBy, tick]);

    return (
        <main className="find-flight">
            <div className="find-flight__header">
                <p className="find-flight__welcome">Welcome back, {name}</p>
                <h1 className="find-flight__title">Find flight</h1>
                <p className="find-flight__subtitle">
                    Fleet overview and inspection status
                </p>
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

            <div
                style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem" }}
            >
                <button
                    type="button"
                    className={`find-flight__filter-tab ${activeSessionsView ? "find-flight__filter-tab--active" : ""}`}
                    onClick={() => {
                        setActiveSessionsView(!activeSessionsView);
                        setSelectedFlight(null);
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                    }}
                >
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#22c55e",
                        }}
                    />
                    View All Active Inspections
                </button>
            </div>

            {activeSessionsView ? (
                <div className="find-flight__sessions-grid-wrap">
                    <h2
                        className="find-flight__detail-title"
                        style={{ marginBottom: "1rem" }}
                    >
                        Active Inspections
                    </h2>
                    {globalLoading && (
                        <p className="find-flight__loading">
                            Loading inspections…
                        </p>
                    )}
                    {!globalLoading && globalSessions.length === 0 && (
                        <p className="find-flight__loading">
                            No active inspections found.
                        </p>
                    )}
                    <div className="find-flight__flights-grid">
                        {globalSessions.map((s) => (
                            <div
                                key={s.id}
                                className="find-flight__flights-tile"
                                style={{
                                    cursor: "default",
                                    paddingRight: "3rem",
                                    position: "relative",
                                }}
                            >
                                <button
                                    type="button"
                                    style={{
                                        position: "absolute",
                                        top: "0.5rem",
                                        right: "0.5rem",
                                        background: "rgba(239, 68, 68, 0.2)",
                                        color: "#fca5a5",
                                        border: "none",
                                        borderRadius: "4px",
                                        padding: "0.25rem 0.5rem",
                                        cursor: "pointer",
                                        zIndex: 10,
                                        fontSize: "1.2rem",
                                        lineHeight: "1rem",
                                        width: "24px",
                                        height: "24px",
                                        display:
                                            s.inspector_id === currentUserId
                                                ? "flex"
                                                : "none",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const {
                                            data: { user },
                                        } = await supabase.auth.getUser();
                                        if (!user) return;

                                        // Only creator can delete
                                        if (s.inspector_id !== user.id) {
                                            alert(
                                                "Only the session creator can delete this session.",
                                            );
                                            return;
                                        }

                                        if (
                                            confirm(
                                                "Permanently delete this session?",
                                            )
                                        ) {
                                            await supabase
                                                .from("inspection_sessions")
                                                .delete()
                                                .eq("id", s.id);
                                        }
                                    }}
                                >
                                    {/* Only show '×' if I am the owner? We can query valid user in the map but simpler to just show it and alert if not allowed, or better: conditionally render. 
                       But we need async check for user ID. Simpler: fetch user once in component.
                   */}
                                    ×
                                </button>
                                <button
                                    type="button"
                                    className="find-flight__flights-tile-body"
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                    onClick={() =>
                                        navigate(`/dashboard?sessionId=${s.id}`)
                                    }
                                >
                                    <span
                                        className="find-flight__flights-route"
                                        style={{ fontSize: "1.1rem" }}
                                    >
                                        {s.flight_number || "Unknown Flight"}
                                    </span>
                                    <span
                                        className="find-flight__flights-label"
                                        style={{ color: "#60a5fa" }}
                                    >
                                        {s.progress_pct}% Complete
                                    </span>
                                    <span className="find-flight__flights-secondary">
                                        Started {formatTime(s.started_at)}
                                    </span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className="find-flight__filter-row">
                        <div
                            className="find-flight__filter-tabs"
                            role="tablist"
                            aria-label="Time filter"
                        >
                            {FILTERS.map((f: { id: TimeFilter; label: string }) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={timeFilter === f.id}
                                    aria-controls="flights-panel"
                                    id={`tab-${f.id}`}
                                    className={`find-flight__filter-tab ${timeFilter === f.id ? "find-flight__filter-tab--active" : ""}`}
                                    onClick={() => setTimeFilter(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Role Selector Overlay (if missing) */}
                        {!roleLoading && !userRole && (
                            <div style={{
                                position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div style={{ background: '#1c1c1e', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '90%', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                    <img src="/aalogo.png" alt="AA" style={{ width: 48, height: 48, marginBottom: '1rem' }} />
                                    <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Select Your Role</h2>
                                    <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>To customize your inspection checklist, please confirm your role for today's shift.</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {['Pilot', 'Flight Attendant', 'Mechanic', 'Ground Crew'].map(r => (
                                            <button 
                                                key={r}
                                                onClick={() => handleSetRole(r)}
                                                style={{ 
                                                    padding: '1rem', borderRadius: '12px', border: 'none', 
                                                    background: 'rgba(255,255,255,0.08)', color: '#fff', 
                                                    fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="find-flight__sort-wrap" ref={sortRef}>
                            <button
                                type="button"
                                className="find-flight__sort-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSortOpen((o) => !o);
                                }}
                                aria-expanded={sortOpen}
                                aria-haspopup="listbox"
                                aria-label="Sort and filter"
                            >
                                <svg
                                    className="find-flight__sort-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                >
                                    <line x1="4" y1="8" x2="20" y2="8" />
                                    <line x1="4" y1="14" x2="14" y2="14" />
                                    <line x1="4" y1="20" x2="10" y2="20" />
                                </svg>
                                <span>Sort</span>
                            </button>
                            {sortOpen && (
                                <ul
                                    className="find-flight__sort-dropdown"
                                    role="listbox"
                                    tabIndex={-1}
                                >
                                    {SORT_OPTIONS.map((opt) => (
                                        <li
                                            key={opt.value}
                                            role="option"
                                            aria-selected={sortBy === opt.value}
                                        >
                                            <button
                                                type="button"
                                                className={`find-flight__sort-opt ${sortBy === opt.value ? "find-flight__sort-opt--active" : ""}`}
                                                onClick={() => {
                                                    setSortBy(opt.value);
                                                    setSortOpen(false);
                                                }}
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
                            Flight Engine unavailable. Check Render URL or
                            proxy.
                        </div>
                    )}

                    {loading && (
                        <p className="find-flight__loading">Loading flights…</p>
                    )}

                    {!loading && !error && selectedFlight ? (
                        <div
                            id="flights-panel"
                            className="find-flight__detail-view"
                            role="region"
                            aria-label="Flight details"
                        >
                            <div
                                className="find-flight__canvas-placeholder"
                                id="find-flight-three-container"
                            >
                                <PlaneModelViewer />
                            </div>
                            <div className="find-flight__detail-panel">
                                <button
                                    type="button"
                                    className="find-flight__detail-back"
                                    onClick={() => setSelectedFlight(null)}
                                    aria-label="Back to flight list"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden
                                    >
                                        <path d="M19 12H5M12 19l-7-7 7-7" />
                                    </svg>
                                    Back
                                </button>
                                <div className="find-flight__detail-content">
                                    <h2 className="find-flight__detail-title">
                                        AA{selectedFlight.flightNumber}
                                    </h2>
                                    <div className="find-flight__detail-route">
                                        <div className="find-flight__detail-route-legs">
                                            <span className="find-flight__detail-airport">
                                                <strong>
                                                    {selectedFlight.origin.code}
                                                </strong>
                                                <em>
                                                    {selectedFlight.origin.city}
                                                </em>
                                            </span>
                                            <span
                                                className="find-flight__detail-arrow"
                                                aria-hidden
                                            >
                                                →
                                            </span>
                                            <span className="find-flight__detail-airport">
                                                <strong>
                                                    {
                                                        selectedFlight
                                                            .destination.code
                                                    }
                                                </strong>
                                                <em>
                                                    {
                                                        selectedFlight
                                                            .destination.city
                                                    }
                                                </em>
                                            </span>
                                        </div>
                                        <RouteMap
                                            origin={selectedFlight.origin}
                                            destination={
                                                selectedFlight.destination
                                            }
                                        />
                                    </div>
                                    <dl className="find-flight__detail-meta">
                                        <div className="find-flight__detail-meta-row">
                                            <dt>Departure</dt>
                                            <dd>
                                                {formatDateTime(
                                                    selectedFlight.departureTime,
                                                )}
                                            </dd>
                                        </div>
                                        <div className="find-flight__detail-meta-row">
                                            <dt>Arrival</dt>
                                            <dd>
                                                {formatDateTime(
                                                    selectedFlight.arrivalTime,
                                                )}
                                            </dd>
                                        </div>
                                        <div className="find-flight__detail-meta-row">
                                            <dt>Duration</dt>
                                            <dd>
                                                {selectedFlight.duration.locale}
                                            </dd>
                                        </div>
                                        <div className="find-flight__detail-meta-row">
                                            <dt>Aircraft</dt>
                                            <dd>
                                                {selectedFlight.aircraft.model}{" "}
                                                ·{" "}
                                                {selectedFlight.aircraft.speed}{" "}
                                                mph ·{" "}
                                                {
                                                    selectedFlight.aircraft
                                                        .passengerCapacity.total
                                                }{" "}
                                                seats
                                            </dd>
                                        </div>
                                        <div className="find-flight__detail-meta-row">
                                            <dt>Distance</dt>
                                            <dd>
                                                {selectedFlight.distance.toLocaleString()}{" "}
                                                km
                                            </dd>
                                        </div>
                                    </dl>

                                    {activeSessions.length > 0 && (
                                        <div className="find-flight__sessions-list">
                                            <h3 className="find-flight__sessions-title">
                                                Live Inspections
                                            </h3>
                                            {activeSessions.map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className="find-flight__session-btn"
                                                    onClick={() =>
                                                        navigate(
                                                            `/dashboard?sessionId=${s.id}`,
                                                            {
                                                                state: {
                                                                    flight: selectedFlight,
                                                                },
                                                            },
                                                        )
                                                    }
                                                >
                                                    <div className="find-flight__session-info">
                                                        <span className="find-flight__session-status">
                                                            In Progress
                                                        </span>
                                                        <span className="find-flight__session-meta">
                                                            {s.progress_pct}%
                                                            complete
                                                        </span>
                                                    </div>
                                                    <span className="find-flight__session-join">
                                                        Join →
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="find-flight__detail-continue"
                                    onClick={async () => {
                                        const userId = session?.user?.id;
                                        const flightNumber = `AA${selectedFlight.flightNumber}`;
                                        if (userId) {
                                            await supabase
                                                .from("user_flights")
                                                .upsert(
                                                    {
                                                        user_id: userId,
                                                        flight_number:
                                                            flightNumber,
                                                        selected_at:
                                                            new Date().toISOString(),
                                                    },
                                                    { onConflict: "user_id" },
                                                );
                                        }
                                        navigate("/dashboard", {
                                            state: { flight: selectedFlight },
                                        });
                                    }}
                                >
                                    Continue
                                    <span
                                        className="find-flight__detail-continue-arrow"
                                        aria-hidden
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </span>
                                </button>
                            </div>
                        </div>
                    ) : !loading && !error ? (
                        <div id="flights-panel" className="find-flight__flights-grid--container">
                            {/* Scheduled Section */}
                            {myFlights.length > 0 && (
                                <div style={{ marginBottom: "2rem" }}>
                                    <h2
                                        className="find-flight__detail-title"
                                        style={{
                                            fontSize: "1.2rem",
                                            marginBottom: "1rem",
                                        }}
                                    >
                                        Scheduled Flights
                                    </h2>
                                    <div
                                        role="list"
                                        className="find-flight__flights-grid"
                                    >
                                        {flights
                                            .filter((f) =>
                                                myFlights.includes(
                                                    `AA${f.flightNumber}`,
                                                ),
                                            )
                                            .map((f) => (
                                                <button
                                                    key={`sched-${f.flightNumber}`}
                                                    type="button"
                                                    role="listitem"
                                                    className="find-flight__flights-tile find-flight__flights-tile--selected"
                                                    onClick={() =>
                                                        setSelectedFlight(f)
                                                    }
                                                >
                                                    <img
                                                        src="/aalogo.png"
                                                        alt=""
                                                        className="find-flight__flights-logo"
                                                        aria-hidden
                                                    />
                                                    <div className="find-flight__flights-tile-body">
                                                        <span className="find-flight__flights-route">
                                                            {f.origin.code} →{" "}
                                                            {f.destination.code}
                                                        </span>
                                                        <span className="find-flight__flights-label">
                                                            AA{f.flightNumber} ·{" "}
                                                            {f.aircraft.model}
                                                        </span>
                                                        <span className="find-flight__flights-secondary">
                                                            {formatTime(
                                                                f.departureTime,
                                                            )}{" "}
                                                            –{" "}
                                                            {formatTime(
                                                                f.arrivalTime,
                                                            )}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        {flights.filter((f) =>
                                            myFlights.includes(
                                                `AA${f.flightNumber}`,
                                            ),
                                        ).length === 0 && (
                                            <p className="find-flight__hint">
                                                No scheduled flights match your
                                                current filters.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Section */}
                            <div>
                                <h2
                                    className="find-flight__detail-title"
                                    style={{
                                        fontSize: "1.2rem",
                                        marginBottom: "1rem",
                                    }}
                                >
                                    Upcoming Flights
                                </h2>
                                <div
                                    className="find-flight__flights-grid"
                                    role="list"
                                >
                                    {filtered
                                        .filter(
                                            (f) =>
                                                !myFlights.includes(
                                                    `AA${f.flightNumber}`,
                                                ),
                                        )
                                        .map((f) => (
                                            <button
                                                key={`${f.flightNumber}-${f.origin.code}-${f.destination.code}-${f.departureTime}`}
                                                type="button"
                                                role="listitem"
                                                className="find-flight__flights-tile"
                                                onClick={() =>
                                                    setSelectedFlight(f)
                                                }
                                            >
                                                <img
                                                    src="/aalogo.png"
                                                    alt=""
                                                    className="find-flight__flights-logo"
                                                    aria-hidden
                                                />
                                                <div className="find-flight__flights-tile-body">
                                                    <span className="find-flight__flights-route">
                                                        {f.origin.code} →{" "}
                                                        {f.destination.code}
                                                    </span>
                                                    <span className="find-flight__flights-label">
                                                        AA{f.flightNumber} ·{" "}
                                                        {f.aircraft.model}
                                                    </span>
                                                    <span className="find-flight__flights-secondary">
                                                        {formatTime(
                                                            f.departureTime,
                                                        )}{" "}
                                                        –{" "}
                                                        {formatTime(
                                                            f.arrivalTime,
                                                        )}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </main>
    );
}
