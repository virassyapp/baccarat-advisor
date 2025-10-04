// /lib/supabase/client.js
const { createClient } = require('@supabase/supabase-js');

let supabaseClient = null;

function getSupabaseClient() {
    if (!supabaseClient) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!url || !key) {
            throw new Error('Supabase credentials are not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.');
        }
        
        supabaseClient = createClient(url, key);
    }
    
    return supabaseClient;
}

module.exports = { getSupabaseClient };