-- 1. Identify and close duplicate active sessions, keeping only the most recently updated one for each flight
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY flight_number 
           ORDER BY updated_at DESC, started_at DESC
         ) as rn
  FROM inspection_sessions
  WHERE status = 'active' AND flight_number IS NOT NULL
)
UPDATE inspection_sessions
SET status = 'completed', ended_at = now()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2. Drop the index if it exists (to ensure clean slate)
DROP INDEX IF EXISTS idx_unique_active_session_per_flight;

-- 3. Re-create the unique index
CREATE UNIQUE INDEX idx_unique_active_session_per_flight 
ON inspection_sessions (flight_number) 
WHERE status = 'active';
