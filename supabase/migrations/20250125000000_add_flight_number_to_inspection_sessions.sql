-- Add flight_number so the dashboard can show which flight an inspection is for
ALTER TABLE inspection_sessions ADD COLUMN IF NOT EXISTS flight_number text;
