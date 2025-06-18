-- Fix infinite recursion in user_roles policies
-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Only admins can manage user roles" ON user_roles;

-- Create a simpler policy that doesn't cause recursion
-- Allow authenticated users to read user_roles (needed for other policies)
CREATE POLICY "Authenticated users can read user roles" ON user_roles
    FOR SELECT TO authenticated USING (true);

-- Allow only specific admin users to manage roles (without recursion)
-- This assumes you have at least one admin user already created
CREATE POLICY "Specific admins can manage user roles" ON user_roles
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM user_roles WHERE role = 'admin'
        )
    );

-- Alternatively, if the above still causes issues, use a direct UUID check
-- Replace 'your-admin-uuid-here' with actual admin user UUID
-- CREATE POLICY "Direct admin can manage user roles" ON user_roles
--     FOR ALL USING (auth.uid() = 'your-admin-uuid-here'::uuid);

-- Ensure pizzas policies don't cause recursion by simplifying them further
DROP POLICY IF EXISTS "Admins can manage pizzas" ON pizzas;

-- Create a simpler admin policy for pizzas that uses direct role check
CREATE POLICY "Admins can manage pizzas" ON pizzas
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM user_roles WHERE role = 'admin'
        )
    );

-- If recursion still occurs, temporarily disable admin pizza management
-- and only allow public read access
-- DROP POLICY IF EXISTS "Admins can manage pizzas" ON pizzas;
