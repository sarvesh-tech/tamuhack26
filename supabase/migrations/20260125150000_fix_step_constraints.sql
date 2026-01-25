-- Ensure inspection_step_instances has a unique constraint for upsert to work
ALTER TABLE inspection_step_instances 
ADD CONSTRAINT inspection_step_instances_session_id_step_id_key 
UNIQUE (session_id, step_id);
-- If it fails because duplicates exist, we might need to clean up first, but let's assume it's clean or fresh logic.
-- If duplicates exist, this query will fail. 
-- In production we would deduplicate. For this hackathon scope, we'll try to add it.
