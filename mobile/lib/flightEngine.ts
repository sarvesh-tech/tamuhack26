/**
 * Flight Engine API client. Uses the same API as the web app.
 */

export interface Airport {
  code: string
  city: string
  timezone: string
  location: { latitude: number; longitude: number }
}

export interface Duration {
  locale: string
  hours: number
  minutes: number
}

export interface Aircraft {
  model: string
  passengerCapacity: { total: number; main: number; first: number }
  speed: number
}

export interface Flight {
  flightNumber: string
  origin: Airport
  destination: Airport
  distance: number
  duration: Duration
  departureTime: string
  arrivalTime: string
  aircraft: Aircraft
}

const DEFAULT_BASE = 'https://flight-engine-jek1.onrender.com'

function getBase(): string {
  return process.env.EXPO_PUBLIC_FLIGHT_ENGINE_BASE_URL || DEFAULT_BASE
}

function todayYYYYMMDD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Fetch flights from the Flight Engine. Pass flightNumber from user_flights (e.g. "AA123").
 */
export async function getFlights(
  date?: string,
  flightNumber?: string
): Promise<Flight[]> {
  const base = getBase().replace(/\/$/, '')
  const d = date || todayYYYYMMDD()
  const url = new URL(`${base}/flights`)
  url.searchParams.set('date', d)
  if (flightNumber) url.searchParams.set('flightNumber', flightNumber)

  const res = await fetch(url.toString())
  const text = await res.text()
  if (!res.ok) throw new Error(`Flight Engine ${res.status}: ${text || res.statusText}`)
  if (!text) return []
  const data = JSON.parse(text)
  return Array.isArray(data) ? data : []
}
