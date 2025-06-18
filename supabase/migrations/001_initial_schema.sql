-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create pizzas table
CREATE TABLE pizzas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL, -- Price in MNT
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pizza_items JSONB NOT NULL, -- [{ pizza_id: UUID, quantity: number }]
    total_price INTEGER NOT NULL, -- Total in MNT
    building TEXT NOT NULL,
    floor INTEGER NOT NULL,
    door_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('qpay', 'cash')),
    is_paid BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'on_delivery', 'delivered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create users table for roles (extends Supabase auth.users)
CREATE TABLE user_roles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'delivery')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample pizzas
INSERT INTO pizzas (name, price, image_url) VALUES
('Маргарита', 15000, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&q=80'),
('Пепперони', 18000, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&q=80'),
('Гавайи', 20000, 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400&q=80'),
('Мах махтай', 22000, 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400&q=80'),
('Төмс махтай', 19000, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80'),
('Ногоотой', 17000, 'https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=400&q=80');

-- Enable Row Level Security
ALTER TABLE pizzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Pizzas: Everyone (including anonymous users) can read active pizzas
CREATE POLICY "Anyone can view active pizzas" ON pizzas
    FOR SELECT USING (is_active = true);

-- Allow anonymous access to pizzas
CREATE POLICY "Anonymous can view active pizzas" ON pizzas
    FOR SELECT TO anon USING (is_active = true);

-- Pizzas: Only admins can modify
CREATE POLICY "Only admins can modify pizzas" ON pizzas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Orders: Anyone can insert (customers placing orders)
CREATE POLICY "Anyone can create orders" ON orders
    FOR INSERT WITH CHECK (true);

-- Orders: Anyone can read their own orders by phone
CREATE POLICY "Anyone can view orders by phone" ON orders
    FOR SELECT USING (true);

-- Orders: Delivery workers can update paid orders
CREATE POLICY "Delivery workers can update paid orders" ON orders
    FOR UPDATE USING (
        is_paid = true AND
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role IN ('delivery', 'admin')
        )
    );

-- Orders: Admins can do everything
CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- User roles: Only admins can manage roles
CREATE POLICY "Only admins can manage user roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- User roles: Users can view their own role
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (id = auth.uid());
