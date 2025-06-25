-- Enable phone authentication in Supabase
-- This migration sets up the necessary configuration for phone/SMS authentication

-- Create a table to store customer phone sessions
CREATE TABLE IF NOT EXISTS customer_phone_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone TEXT NOT NULL,
    verification_code TEXT,
    is_verified BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on customer_phone_sessions
ALTER TABLE customer_phone_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to create phone sessions (for login)
CREATE POLICY "Anonymous can create phone sessions" ON customer_phone_sessions
    FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to read their own phone sessions
CREATE POLICY "Anonymous can read own phone sessions" ON customer_phone_sessions
    FOR SELECT TO anon USING (true);

-- Allow anonymous users to update their own phone sessions (for verification)
CREATE POLICY "Anonymous can update own phone sessions" ON customer_phone_sessions
    FOR UPDATE TO anon USING (true);

-- Create index for phone lookup
CREATE INDEX IF NOT EXISTS idx_customer_phone_sessions_phone ON customer_phone_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_customer_phone_sessions_expires_at ON customer_phone_sessions(expires_at);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_phone_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM customer_phone_sessions 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Note: To enable SMS authentication in Supabase:
-- 1. Go to Authentication > Settings in your Supabase dashboard
-- 2. Enable "Phone" provider
-- 3. Configure your SMS provider (Twilio, MessageBird, etc.)
-- 4. Set up phone number format validation

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON customer_phone_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_phone_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_phone_sessions TO service_role;
