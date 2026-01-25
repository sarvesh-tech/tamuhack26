-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  updated_at timestamptz DEFAULT now()
);

alter table profiles enable row level security;
create policy "Users can view all profiles" on profiles for select using (true);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);

-- Create session_delete_votes table
CREATE TABLE IF NOT EXISTS session_delete_votes (
  session_id uuid REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

alter table session_delete_votes enable row level security;
create policy "Users can view active votes" on session_delete_votes for select using (true);
create policy "Users can vote" on session_delete_votes for insert with check (auth.uid() = user_id);
create policy "Users can remove vote" on session_delete_votes for delete using (auth.uid() = user_id);
