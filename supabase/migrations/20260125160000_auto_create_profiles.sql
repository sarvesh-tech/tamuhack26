-- Add email column to profiles for easy reference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, updated_at)
  VALUES (new.id, new.email, null, now())
  ON CONFLICT (id) DO UPDATE SET email = new.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also update existing users who don't have a profile yet
INSERT INTO profiles (id, email, role, updated_at)
SELECT id, email, null, now() FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
