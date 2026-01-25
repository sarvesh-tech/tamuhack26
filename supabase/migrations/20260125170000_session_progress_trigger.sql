-- Function to update session progress when steps change
CREATE OR REPLACE FUNCTION update_session_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_total_steps INTEGER;
  v_completed_steps INTEGER;
BEGIN
  -- Get total steps and completed/skipped count for this session
  SELECT total_steps INTO v_total_steps FROM inspection_sessions WHERE id = NEW.session_id;
  
  SELECT COUNT(*) INTO v_completed_steps 
  FROM inspection_step_instances 
  WHERE session_id = NEW.session_id AND status IN ('completed', 'skipped');
  
  -- Update the session record
  UPDATE inspection_sessions 
  SET 
    steps_completed = v_completed_steps,
    progress_pct = CASE WHEN v_total_steps > 0 THEN (v_completed_steps * 100 / v_total_steps) ELSE 0 END,
    updated_at = now()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after any insert/update/delete on step instances
DROP TRIGGER IF EXISTS tr_update_session_progress ON inspection_step_instances;
CREATE TRIGGER tr_update_session_progress
AFTER INSERT OR UPDATE OR DELETE ON inspection_step_instances
FOR EACH ROW EXECUTE FUNCTION update_session_progress();
