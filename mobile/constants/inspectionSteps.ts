export type Role = 'Pilot' | 'Flight Attendant' | 'Mechanic' | 'Ground Crew'

export const INSPECTION_STEPS = [
  // Cabin Safety (4 items)
  { id: 1, title: 'Emergency exits unobstructed and correctly armed', allowedRoles: ['Flight Attendant', 'Pilot'] },
  { id: 2, title: 'Fire extinguishers present and pressure-checked', allowedRoles: ['Flight Attendant', 'Mechanic'] },
  { id: 3, title: 'Oxygen masks properly stowed', allowedRoles: ['Flight Attendant', 'Mechanic'] },
  { id: 4, title: 'First aid kit / AED onboard and sealed', allowedRoles: ['Flight Attendant'] },

  // Passenger Area (3 items)
  { id: 5, title: 'Seat belts present and fastenable', allowedRoles: ['Flight Attendant', 'Ground Crew'] },
  { id: 6, title: 'Overhead bins closed and latched', allowedRoles: ['Flight Attendant', 'Ground Crew'] },
  { id: 7, title: 'Aisles and exits clear', allowedRoles: ['Flight Attendant'] },

  // Doors & Galleys (3 items)
  { id: 8, title: 'Aircraft doors in correct configuration', allowedRoles: ['Flight Attendant', 'Pilot', 'Ground Crew'] },
  { id: 9, title: 'Galleys secured (no loose items)', allowedRoles: ['Flight Attendant'] },
  { id: 10, title: 'Lavatories clean and stocked', allowedRoles: ['Ground Crew', 'Flight Attendant'] },

  // Paperwork & Final (5 items)
  { id: 11, title: 'Safety manuals and briefing cards present', allowedRoles: ['Flight Attendant'] },
  { id: 12, title: 'Crew brief completed', allowedRoles: ['Pilot', 'Flight Attendant'] },
  { id: 13, title: 'Captain informed of cabin status', allowedRoles: ['Flight Attendant'] },
  { id: 14, title: 'Cabin secured for taxi', allowedRoles: ['Flight Attendant'] },
  { id: 15, title: 'Cabin ready call made to flight deck', allowedRoles: ['Flight Attendant'] },
] as const
