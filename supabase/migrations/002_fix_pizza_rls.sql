-- Drop existing policies for pizzas table
DROP POLICY IF EXISTS "Anyone can view active pizzas" ON pizzas;
DROP POLICY IF EXISTS "Anonymous can view active pizzas" ON pizzas;
DROP POLICY IF EXISTS "Only admins can modify pizzas" ON pizzas;

-- Create a single, simple policy for reading pizzas
CREATE POLICY "Public can read active pizzas" ON pizzas
    FOR SELECT USING (is_active = true);

-- Allow admins to manage pizzas
CREATE POLICY "Admins can manage pizzas" ON pizzas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Grant explicit permissions to anonymous users
GRANT SELECT ON pizzas TO anon;
GRANT SELECT ON pizzas TO authenticated;
