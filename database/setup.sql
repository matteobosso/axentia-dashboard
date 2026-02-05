-- Axentia Dashboard Database Setup
-- Run this script on your PostgreSQL database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ============================================
-- Table: companies
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    n8n_endpoint VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for domain lookups
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);

-- ============================================
-- Table: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    company_id UUID REFERENCES companies(company_id) ON DELETE SET NULL,
    n8n_endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- Table: support_tickets
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'technical' CHECK (category IN ('technical', 'billing', 'feature_request', 'other')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Create indexes for ticket queries
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON support_tickets(created_at DESC);

-- ============================================
-- Table: ticket_messages
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,  -- Internal notes visible only to admins
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON ticket_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON ticket_messages(created_at);

-- ============================================
-- Table: n8n_vectors (for RAG - if not already created)
-- ============================================
CREATE TABLE IF NOT EXISTS n8n_vectors (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(768)
);

-- Create vector index for similarity search
CREATE INDEX IF NOT EXISTS idx_vectors_embedding ON n8n_vectors USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_vectors_company_id ON n8n_vectors ((metadata->>'company_id'));

-- ============================================
-- Insert initial admin user (Axentia)
-- NOTE: You must replace 'FIREBASE_UID_HERE' with the actual Firebase UID
-- after creating the user in Firebase
-- ============================================
INSERT INTO companies (company_id, name, domain, n8n_endpoint)
VALUES (
    gen_random_uuid(),
    'Axentia Automation',
    'axentia-automation.it',
    'https://main-n8n.axentia-automation.it'
) ON CONFLICT (domain) DO NOTHING;

-- Get the Axentia company_id for the admin user
-- This INSERT should be run AFTER you get the Firebase UID
/*
INSERT INTO users (firebase_uid, email, display_name, role, company_id, n8n_endpoint)
SELECT
    'FIREBASE_UID_HERE',  -- Replace with actual Firebase UID
    'info@axentia-automation.it',
    'Axentia Admin',
    'admin',
    company_id,
    'https://main-n8n.axentia-automation.it'
FROM companies
WHERE domain = 'axentia-automation.it'
ON CONFLICT (email) DO NOTHING;
*/

-- ============================================
-- Useful Views
-- ============================================

-- View: Users with company info
CREATE OR REPLACE VIEW users_with_company AS
SELECT
    u.user_id,
    u.firebase_uid,
    u.email,
    u.display_name,
    u.role,
    u.is_active,
    u.last_login_at,
    u.created_at,
    c.company_id,
    c.name AS company_name,
    c.domain AS company_domain,
    COALESCE(u.n8n_endpoint, c.n8n_endpoint) AS effective_n8n_endpoint
FROM users u
LEFT JOIN companies c ON u.company_id = c.company_id;

-- View: Tickets with user and company info
CREATE OR REPLACE VIEW tickets_with_details AS
SELECT
    t.ticket_id,
    t.subject,
    t.description,
    t.category,
    t.status,
    t.priority,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    t.company_id,
    c.name AS company_name,
    t.created_by,
    u.email AS created_by_email,
    u.display_name AS created_by_name,
    (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.ticket_id) AS message_count
FROM support_tickets t
JOIN companies c ON t.company_id = c.company_id
JOIN users u ON t.created_by = u.user_id;

-- ============================================
-- Functions for updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Grant permissions (adjust as needed)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMENT ON TABLE companies IS 'Tenant companies for multi-tenant architecture';
COMMENT ON TABLE users IS 'User accounts with Firebase Auth integration';
COMMENT ON TABLE support_tickets IS 'Support ticket system';
COMMENT ON TABLE ticket_messages IS 'Messages/replies on support tickets';
COMMENT ON TABLE n8n_vectors IS 'Vector embeddings for RAG knowledge base';
