-- Completely eliminate recursion by temporarily disabling problematic policies
-- This will allow the app to function while you set up proper admin access

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'delivery')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Only admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Authenticated users can read user roles" ON user_roles;
DROP POLICY IF EXISTS "Specific admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage pizzas" ON pizzas;

-- For now, allow all authenticated users to read user_roles
-- This prevents recursion while still maintaining some security
CREATE POLICY "Allow authenticated read user_roles" ON user_roles
    FOR SELECT TO authenticated USING (true);

-- Allow only the table owner or service role to manage user_roles
-- This avoids recursion by not checking user_roles table within the policy
CREATE POLICY "Service role can manage user_roles" ON user_roles
    FOR ALL TO service_role USING (true);

-- Temporarily allow all authenticated users to read pizzas
-- Remove admin-only policies that cause recursion
CREATE POLICY "Anyone can read pizzas" ON pizzas
    FOR SELECT TO anon, authenticated USING (true);

-- Only service role can manage pizzas (for now)
CREATE POLICY "Service role can manage pizzas" ON pizzas
    FOR ALL TO service_role USING (true);

-- Note: After applying this migration, you can manually add admin users
-- through the Supabase dashboard and then create more restrictive policies
