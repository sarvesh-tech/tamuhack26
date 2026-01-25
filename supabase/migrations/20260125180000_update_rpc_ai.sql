-- Update complete_step RPC to include AI fields
CREATE OR REPLACE FUNCTION rpc_complete_step(
  p_session_id UUID,
  p_step_id INTEGER,
  p_photo_path TEXT,
  p_transcript TEXT,
  p_completed_at TIMESTAMPTZ,
  p_ai_severity TEXT DEFAULT 'none',
  p_ai_analysis TEXT DEFAULT NULL
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
    ai_analysis = p_ai_analysis
  WHERE session_id = p_session_id AND step_id = p_step_id;
END;
$$;
