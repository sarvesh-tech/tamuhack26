-- Ensure user_flights has composite PK or unique constraint on (user_id, flight_number)
-- First drop existing constraint if it exists (assuming it was just user_id from mobile implementation? or maybe it was already composite)
-- Mobile code used: .upsert({ user_id, flight_number }, { onConflict: 'user_id' }) which implies user_id was unique.
-- We must change this.

ALTER TABLE user_flights DROP CONSTRAINT IF EXISTS user_flights_pkey;
ALTER TABLE user_flights DROP CONSTRAINT IF EXISTS user_flights_user_id_key; -- if strictly 1:1

-- Add composite key
ALTER TABLE user_flights ADD PRIMARY KEY (user_id, flight_number);

-- Enable RLS if not already
ALTER TABLE user_flights ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own flights" ON user_flights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flights" ON user_flights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own flights" ON user_flights FOR DELETE USING (auth.uid() = user_id);
