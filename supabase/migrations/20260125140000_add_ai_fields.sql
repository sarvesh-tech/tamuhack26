-- Add AI fields to inspection_step_instances
ALTER TABLE inspection_step_instances 
ADD COLUMN IF NOT EXISTS ai_severity TEXT CHECK (ai_severity IN ('low', 'medium', 'high', 'none')),
ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
