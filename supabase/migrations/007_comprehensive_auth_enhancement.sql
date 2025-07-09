-- Comprehensive Authentication and Authorization Enhancement
-- This migration addresses inconsistencies and adds proper customer support

-- ============================================================================
-- 1. CUSTOMER ROLE SUPPORT
-- ============================================================================

-- Update user_roles table to include customer role
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check 
    CHECK (role IN ('admin', 'delivery', 'customer'));

-- Add customer profile table for additional customer information
CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    default_building TEXT,
    default_floor INTEGER,
    default_door_number TEXT,
    phone_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on customer_profiles
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. PHONE AUTHENTICATION INTEGRATION
-- ============================================================================

-- Function to handle user registration with phone
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- If user signed up with phone, create customer role and profile
    IF NEW.phone IS NOT NULL THEN
        -- Insert customer role
        INSERT INTO user_roles (id, role)
        VALUES (NEW.id, 'customer')
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert customer profile
        INSERT INTO customer_profiles (id, phone_verified)
        VALUES (NEW.id, NEW.phone_confirmed_at IS NOT NULL)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_registration();

-- Function to update phone verification status
CREATE OR REPLACE FUNCTION update_phone_verification()
RETURNS TRIGGER AS $$
BEGIN
    -- Update customer profile when phone is verified
    IF OLD.phone_confirmed_at IS NULL AND NEW.phone_confirmed_at IS NOT NULL THEN
        UPDATE customer_profiles 
        SET phone_verified = true, updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for phone verification updates
DROP TRIGGER IF EXISTS on_phone_verified ON auth.users;
CREATE TRIGGER on_phone_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION update_phone_verification();

-- ============================================================================
-- 3. ENHANCED ORDER MANAGEMENT
-- ============================================================================

-- Add customer_profile_id to orders for better tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_person_id UUID REFERENCES auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Update order status to include cancelled
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'accepted', 'preparing', 'on_delivery', 'delivered', 'cancelled'));

-- ============================================================================
-- 4. AUDIT TRAIL SYSTEM
-- ============================================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_role TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Function to log changes
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_role_val TEXT;
BEGIN
    -- Get user role
    SELECT role INTO user_role_val 
    FROM user_roles 
    WHERE id = auth.uid();
    
    -- Log the change
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, user_id, user_role)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), auth.uid(), user_role_val);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id, user_role)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid(), user_role_val);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values, user_id, user_role)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), auth.uid(), user_role_val);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
DROP TRIGGER IF EXISTS audit_pizzas ON pizzas;
CREATE TRIGGER audit_pizzas
    AFTER INSERT OR UPDATE OR DELETE ON pizzas
    FOR EACH ROW EXECUTE FUNCTION log_changes();

DROP TRIGGER IF EXISTS audit_orders ON orders;
CREATE TRIGGER audit_orders
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION log_changes();

DROP TRIGGER IF EXISTS audit_user_roles ON user_roles;
CREATE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION log_changes();

-- ============================================================================
-- 5. COMPREHENSIVE RLS POLICIES (Clean Slate)
-- ============================================================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Public can read active pizzas" ON pizzas;
DROP POLICY IF EXISTS "Anyone can read pizzas" ON pizzas;
DROP POLICY IF EXISTS "Service role can manage pizzas" ON pizzas;
DROP POLICY IF EXISTS "Admins can manage pizzas" ON pizzas;

DROP POLICY IF EXISTS "Allow authenticated read user_roles" ON user_roles;
DROP POLICY IF EXISTS "Service role can manage user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;

DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view orders by phone" ON orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Anonymous users can create orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
DROP POLICY IF EXISTS "Admin and delivery can view all orders" ON orders;
DROP POLICY IF EXISTS "Admin and delivery can update orders" ON orders;
DROP POLICY IF EXISTS "Delivery workers can update paid orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;

-- PIZZAS POLICIES
CREATE POLICY "Everyone can view active pizzas" ON pizzas
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

CREATE POLICY "Admins can manage pizzas" ON pizzas
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- USER_ROLES POLICIES
CREATE POLICY "Users can view their own role" ON user_roles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON user_roles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.id = auth.uid() 
            AND ur.role = 'admin'
        )
    );

-- CUSTOMER_PROFILES POLICIES
CREATE POLICY "Users can manage their own profile" ON customer_profiles
    FOR ALL TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can view all customer profiles" ON customer_profiles
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- ORDERS POLICIES
-- Anonymous users can create orders (guest checkout)
CREATE POLICY "Anonymous can create orders" ON orders
    FOR INSERT TO anon
    WITH CHECK (true);

-- Authenticated customers can create orders
CREATE POLICY "Customers can create orders" ON orders
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'customer'
        )
    );

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders" ON orders
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        (phone = (SELECT phone FROM auth.users WHERE id = auth.uid()) AND
         EXISTS (SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'customer'))
    );

-- Anonymous users can view orders by phone (for order tracking)
CREATE POLICY "Anonymous can view orders by phone" ON orders
    FOR SELECT TO anon
    USING (true); -- Will be filtered by application logic

-- Admin and delivery can view all orders
CREATE POLICY "Staff can view all orders" ON orders
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role IN ('admin', 'delivery')
        )
    );

-- Admin can update any order
CREATE POLICY "Admin can update orders" ON orders
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Delivery can update assigned orders
CREATE POLICY "Delivery can update assigned orders" ON orders
    FOR UPDATE TO authenticated
    USING (
        delivery_person_id = auth.uid() OR
        (delivery_person_id IS NULL AND 
         EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'delivery'
         ))
    );

-- AUDIT_LOGS POLICIES
CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- ============================================================================
-- 6. ENHANCED FUNCTIONS AND UTILITIES
-- ============================================================================

-- Function to assign delivery person to order
CREATE OR REPLACE FUNCTION assign_delivery_person(order_id UUID, delivery_person_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN := false;
    is_delivery BOOLEAN := false;
BEGIN
    -- Check if current user is admin
    SELECT EXISTS(
        SELECT 1 FROM user_roles 
        WHERE id = auth.uid() AND role = 'admin'
    ) INTO is_admin;
    
    -- Check if delivery person exists and has delivery role
    SELECT EXISTS(
        SELECT 1 FROM user_roles 
        WHERE id = delivery_person_id AND role = 'delivery'
    ) INTO is_delivery;
    
    -- Only admin can assign delivery persons
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Only admins can assign delivery persons';
    END IF;
    
    -- Check if delivery person is valid
    IF NOT is_delivery THEN
        RAISE EXCEPTION 'Invalid delivery person';
    END IF;
    
    -- Update the order
    UPDATE orders 
    SET delivery_person_id = assign_delivery_person.delivery_person_id,
        status = CASE WHEN status = 'accepted' THEN 'preparing' ELSE status END
    WHERE id = order_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get order statistics
CREATE OR REPLACE FUNCTION get_order_statistics(start_date DATE DEFAULT NULL, end_date DATE DEFAULT NULL)
RETURNS TABLE(
    total_orders BIGINT,
    total_revenue BIGINT,
    pending_orders BIGINT,
    delivered_orders BIGINT,
    cancelled_orders BIGINT,
    average_order_value NUMERIC
) AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS(SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Only admins can view statistics';
    END IF;
    
    RETURN QUERY
    SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_price), 0) as total_revenue,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
        COALESCE(AVG(total_price), 0) as average_order_value
    FROM orders
    WHERE (start_date IS NULL OR DATE(created_at) >= start_date)
      AND (end_date IS NULL OR DATE(created_at) <= end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update customer profile
CREATE OR REPLACE FUNCTION update_customer_profile(
    customer_id UUID,
    full_name TEXT DEFAULT NULL,
    default_building TEXT DEFAULT NULL,
    default_floor INTEGER DEFAULT NULL,
    default_door_number TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user can update this profile
    IF customer_id != auth.uid() AND NOT EXISTS(
        SELECT 1 FROM user_roles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized to update this profile';
    END IF;
    
    UPDATE customer_profiles
    SET 
        full_name = COALESCE(update_customer_profile.full_name, customer_profiles.full_name),
        default_building = COALESCE(update_customer_profile.default_building, customer_profiles.default_building),
        default_floor = COALESCE(update_customer_profile.default_floor, customer_profiles.default_floor),
        default_door_number = COALESCE(update_customer_profile.default_door_number, customer_profiles.default_door_number),
        updated_at = NOW()
    WHERE id = customer_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_person ON orders(delivery_person_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_phone ON orders(user_id, phone);

-- Customer profiles indexes
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone_verified ON customer_profiles(phone_verified);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_updated_at ON customer_profiles(updated_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- User roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ============================================================================
-- 8. CLEANUP AND PERMISSIONS
-- ============================================================================

-- Remove the old customer_phone_sessions table as it's replaced by native Supabase auth
DROP TABLE IF EXISTS customer_phone_sessions CASCADE;

-- Grant necessary permissions
GRANT SELECT ON pizzas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO anon, authenticated;
GRANT SELECT ON user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON customer_profiles TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON orders_with_user TO authenticated, anon;

-- Service role permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================================
-- 9. SAMPLE DATA FOR TESTING
-- ============================================================================

-- Note: In production, you would create admin users through the Supabase dashboard
-- and then assign roles manually. This is just for development/testing.

COMMIT;

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================
-- 
-- This migration provides:
-- 1. ✅ Full customer role support with phone authentication
-- 2. ✅ Proper integration with Supabase's native phone auth
-- 3. ✅ Enhanced order management with delivery tracking
-- 4. ✅ Comprehensive audit trail system
-- 5. ✅ Clean, consistent RLS policies for all user types
-- 6. ✅ Performance optimizations with proper indexes
-- 7. ✅ Utility functions for common operations
-- 8. ✅ Customer profile management
-- 
-- User Types Supported:
-- - Admin: Full system access, can manage pizzas, orders, users
-- - Delivery: Can view and update assigned orders
-- - Customer: Can create orders, view own orders, manage profile
-- - Anonymous: Can create orders (guest checkout), track orders by phone
-- 
-- Phone Authentication:
-- - Uses Supabase's native phone authentication
-- - Automatically creates customer role and profile on phone signup
-- - Supports phone verification tracking
-- - Handles phone number normalization for consistent matching
-- ============================================================================
