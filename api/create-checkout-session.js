// /api/create-checkout-session.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, email } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ error: 'userId and email are required' });
        }

        console.log('Creating checkout session for:', { userId, email });

        // Supabaseにユーザーレコードが存在するか確認
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Database fetch error:', fetchError);
        }

        // ユーザーレコードが存在しない場合は作成
        if (!existingUser) {
            console.log('Creating user record in database...');
            const { error: insertError } = await supabase
                .from('users')
                .insert([
                    {
                        id: userId,
                        email: email,
                        is_subscribed: false,
                        subscription_status: 'inactive',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ]);

            if (insertError) {
                console.error('Failed to create user record:', insertError);
                return res.status(500).json({ error: 'Failed to create user record' });
            }
        }

        // Stripe Checkoutセッションを作成
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: 'price_1S7poRCPMV8Fb9FwVzErm4rk', // サブスクリプション価格のID
                    quantity: 1,
                },
            ],
            
            mode: 'subscription', // 一回払い
            customer_email: email,
            metadata: {
                userId: userId,
                email: email
            },
            success_url: `${process.env.DOMAIN || req.headers.origin}?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.DOMAIN || req.headers.origin}?cancelled=true`,
            automatic_tax: {
                enabled: false,
            },
        });

        console.log('Checkout session created:', session.id);
        
        res.status(200).json({
            id: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Checkout session creation error:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}