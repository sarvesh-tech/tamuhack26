-- Update status constraint to include 'skipped'
ALTER TABLE inspection_step_instances DROP CONSTRAINT IF EXISTS inspection_step_instances_status_check;
ALTER TABLE inspection_step_instances ADD CONSTRAINT inspection_step_instances_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'));
