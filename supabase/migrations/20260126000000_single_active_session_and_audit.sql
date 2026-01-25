-- Add completed_by column to tracks who finished the step
ALTER TABLE inspection_step_instances 
ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);

-- Enforce unique active session per flight
-- This prevents multiple "active" sessions for the same flight_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_session_per_flight 
ON inspection_sessions (flight_number) 
WHERE status = 'active';

-- Update RPC to include user_id handling
CREATE OR REPLACE FUNCTION rpc_complete_step(
  p_session_id UUID,
  p_step_id INTEGER,
  p_photo_path TEXT,
  p_transcript TEXT,
  p_completed_at TIMESTAMPTZ,
  p_ai_severity TEXT DEFAULT 'none',
  p_ai_analysis TEXT DEFAULT NULL
  -- p_user_id is inferred from auth.uid() for security
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inspection_step_instances
  SET 
    status = 'completed',
    photo_path = p_photo_path,
    transcript = p_transcript,
    completed_at = p_completed_at,
    ai_severity = p_ai_severity,
    ai_analysis = p_ai_analysis,
    completed_by = auth.uid() -- Automatically set to current user
  WHERE session_id = p_session_id AND step_id = p_step_id;
END;
$$;
