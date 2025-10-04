### `/docs/DEPLOYMENT.md`
```markdown
# Deployment Guide

## Prerequisites

1. GitHub account
2. Vercel account
3. Supabase account
4. NowPayments account

---

## Initial Setup

### 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Go to **Settings** → **API**
3. Copy the following:
   - Project URL (`SUPABASE_URL`)
   - Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)

4. Create the users table:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  is_subscribed BOOLEAN DEFAULT FALSE,
  subscription_status TEXT DEFAULT 'inactive',
  payment_status TEXT,
  nowpayments_invoice_id TEXT,
  nowpayments_order_id TEXT,
  payment_details JSONB,
  subscription_started_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for service role
CREATE POLICY "Service role can do everything" ON users
  FOR ALL
  USING (true)
  WITH CHECK (true);