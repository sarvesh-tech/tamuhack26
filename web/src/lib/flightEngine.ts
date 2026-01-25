/**
 * Flight-Engine API client.
 * Base is "/api" so the browser calls same-origin; Vite dev-server proxies /api/* to
 * Flight-Engine (e.g. Render) to avoid CORS.
 */

export interface Location {
  latitude: number
  longitude: number
}

export interface Airport {
  code: string
  city: string
  timezone: string
  location: Location
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

// Base "/api" is used so the browser calls same-origin; Vite dev-server proxies
// /api/* to Flight-Engine (e.g. Render) to avoid CORS.
const BASE = '/api'

async function flightEngineFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const p = path.replace(/^\/+/, '')
  const url = new URL(`${BASE}/${p}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v)
    })
  }
  const res = await fetch(url.toString())
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Flight-Engine ${res.status}: ${text || res.statusText}`)
  }
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function getAirportsAll(): Promise<Airport[]> {
  return flightEngineFetch<Airport[]>('airports/all')
}

export async function getAirport(code: string): Promise<Airport> {
  return flightEngineFetch<Airport>('airports', { code })
}

const FLIGHTS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const flightsCache = new Map<
  string,
  { data: Flight[]; ts: number }
>()

function flightsCacheKey(
  date: string,
  origin?: string,
  destination?: string,
  flightNumber?: string
): string {
  return `flights:${date}:${origin ?? ''}:${destination ?? ''}:${flightNumber ?? ''}`
}

export async function getFlights(
  date: string,
  origin?: string,
  destination?: string,
  flightNumber?: string
): Promise<Flight[]> {
  const key = flightsCacheKey(date, origin, destination, flightNumber)
  const hit = flightsCache.get(key)
  const now = Date.now()
  if (hit && now - hit.ts < FLIGHTS_CACHE_TTL_MS) {
    return hit.data
  }
  const params: Record<string, string> = { date }
  if (origin) params.origin = origin
  if (destination) params.destination = destination
  if (flightNumber) params.flightNumber = flightNumber
  const data = await flightEngineFetch<Flight[]>('flights', params)
  const list = data ?? []
  flightsCache.set(key, { data: list, ts: now })
  return list
}
