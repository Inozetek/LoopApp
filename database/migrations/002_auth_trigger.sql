-- Migration: Auto-create user profile on signup
-- This trigger ensures that when a user signs up via Supabase Auth,
-- a corresponding record is automatically created in the users table.

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- Ensure RLS is enabled (should already be from previous migration)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Note: The RLS policies from the previous migration will control access:
-- 1. Users can read their own profile
-- 2. Users can update their own profile
-- 3. No deletes allowed by users
