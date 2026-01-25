-- Enable RLS (idempotent)
ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_step_instances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own sessions" ON inspection_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON inspection_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON inspection_sessions;
DROP POLICY IF EXISTS "Users can view their own steps" ON inspection_step_instances;
DROP POLICY IF EXISTS "Users can create their own steps" ON inspection_step_instances;
DROP POLICY IF EXISTS "Users can update their own steps" ON inspection_step_instances;

-- Create broad collaborative policies
CREATE POLICY "Enable read access for all authenticated users" ON inspection_sessions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for all authenticated users" ON inspection_sessions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = inspector_id); -- Creator is still owner initially, but anyone can read

CREATE POLICY "Enable update access for all authenticated users" ON inspection_sessions
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for all authenticated users" ON inspection_sessions
FOR DELETE TO authenticated USING (true);

-- Step instances
CREATE POLICY "Enable read access for all authenticated users" ON inspection_step_instances
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for all authenticated users" ON inspection_step_instances
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for all authenticated users" ON inspection_step_instances
FOR UPDATE TO authenticated USING (true);
