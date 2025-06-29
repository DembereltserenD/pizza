-- Combined phone authentication and order association migration
-- This migration ensures orders are properly associated with authenticated users

-- Add user_id column to orders table to link orders with authenticated users
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for user_id lookup
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Update RLS policies for orders to include user_id based access

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON orders;
DROP POLICY IF EXISTS "Anonymous users can create orders" ON orders;

-- Allow authenticated users to view their own orders (by user_id or phone)
CREATE POLICY "Users can view their own orders" ON orders
    FOR SELECT TO authenticated 
    USING (
        user_id = auth.uid() OR 
        phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
    );

-- Allow anonymous users to create orders (for guest checkout)
CREATE POLICY "Anonymous users can create orders" ON orders
    FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated users to create orders with their user_id
CREATE POLICY "Authenticated users can create orders" ON orders
    FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() OR user_id IS NULL
    );

-- Allow admin and delivery users to view all orders
CREATE POLICY "Admin and delivery can view all orders" ON orders
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role IN ('admin', 'delivery')
        )
    );

-- Allow admin and delivery users to update order status
CREATE POLICY "Admin and delivery can update orders" ON orders
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role IN ('admin', 'delivery')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role IN ('admin', 'delivery')
        )
    );

-- Function to automatically set user_id when creating orders for authenticated users
CREATE OR REPLACE FUNCTION set_order_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- If user is authenticated and user_id is not set, set it
    IF auth.uid() IS NOT NULL AND NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set user_id
DROP TRIGGER IF EXISTS set_order_user_id_trigger ON orders;
CREATE TRIGGER set_order_user_id_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_user_id();

-- Update existing orders to link them with users based on phone numbers
-- This is a one-time operation to associate existing orders with users
UPDATE orders 
SET user_id = auth_users.id
FROM auth.users AS auth_users
WHERE orders.user_id IS NULL 
  AND orders.phone IS NOT NULL 
  AND auth_users.phone IS NOT NULL
  AND (
    -- Match exact phone numbers
    orders.phone = auth_users.phone OR
    -- Match phone numbers with +976 prefix
    orders.phone = REPLACE(auth_users.phone, '+976', '') OR
    -- Match phone numbers without +976 prefix
    '+976' || orders.phone = auth_users.phone
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO service_role;

-- Ensure phone authentication works properly
-- Update auth.users table to ensure phone numbers are properly formatted
-- This helps with consistent phone number matching

-- Function to normalize phone numbers for consistent matching
CREATE OR REPLACE FUNCTION normalize_phone_number(phone_input TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove all non-digit characters
    phone_input := REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g');
    
    -- If starts with 976, add + prefix
    IF phone_input LIKE '976%' AND LENGTH(phone_input) = 11 THEN
        RETURN '+' || phone_input;
    END IF;
    
    -- If 8 digits, add +976 prefix
    IF LENGTH(phone_input) = 8 THEN
        RETURN '+976' || phone_input;
    END IF;
    
    -- Return as is if already properly formatted
    RETURN phone_input;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easier order querying with user information
CREATE OR REPLACE VIEW orders_with_user AS
SELECT 
    o.*,
    u.email as user_email,
    u.phone as user_phone_formatted
FROM orders o
LEFT JOIN auth.users u ON o.user_id = u.id;

-- Grant access to the view
GRANT SELECT ON orders_with_user TO authenticated;
GRANT SELECT ON orders_with_user TO anon;
GRANT SELECT ON orders_with_user TO service_role;

COMMIT;
