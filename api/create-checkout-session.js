const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORSヘッダーの設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 環境変数の確認
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
    }
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ error: 'SUPABASE_URL not configured' });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });
    }

    // リクエストボディの検証
    const { userId, email } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Creating checkout session for user:', userId, email);

    // usersテーブルが存在するかチェック
    let user;
    try {
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, email, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (userError && userError.code === 'PGRST116') {
        // ユーザーが見つからない場合は作成
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: userId,
              email: email,
              created_at: new Date().toISOString(),
              is_subscribed: false
            }
          ])
          .select()
          .single();

        if (insertError) {
          console.error('User insert error:', insertError);
          return res.status(500).json({ error: 'Failed to create user', details: insertError.message });
        }
        user = newUser;
      } else if (userError) {
        console.error('User fetch error:', userError);
        return res.status(500).json({ error: 'Database error', details: userError.message });
      } else {
        user = data;
      }
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return res.status(500).json({ error: 'Database connection failed', details: dbError.message });
    }

    let customerId = user.stripe_customer_id;

    // Stripe Customerが存在しない場合は作成
    if (!customerId) {
      console.log('Creating new Stripe customer for user:', userId);
      
      try {
        const customer = await stripe.customers.create({
          email: user.email || email,
          metadata: {
            userId: userId,
          },
        });

        customerId = customer.id;

        // SupabaseにCustomer IDを保存
        const { error: updateError } = await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);

        if (updateError) {
          console.error('Failed to update customer ID:', updateError);
        }
      } catch (stripeError) {
        console.error('Stripe customer creation error:', stripeError);
        return res.status(500).json({ error: 'Failed to create Stripe customer', details: stripeError.message });
      }
    }

    // サクセスURLとキャンセルURLの設定
    const baseUrl = req.headers.origin || 
                    req.headers.referer?.replace(/\/$/, '') || 
                    `https://${req.headers.host}`;

    // Checkout Sessionの作成
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'バカラ戦略アドバイザー プレミアム',
                description: '高度な戦略アドバイス、リスク管理、詳細な分析機能',
              },
              unit_amount: 990, // $9.90
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${baseUrl}?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${baseUrl}?canceled=true`,
        metadata: {
          userId: userId,
        },
      });

      console.log('Checkout session created:', session.id);

      return res.status(200).json({
        url: session.url,
        sessionId: session.id,
      });
    } catch (stripeError) {
      console.error('Stripe session creation error:', stripeError);
      return res.status(500).json({ 
        error: 'Failed to create checkout session', 
        details: stripeError.message 
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Unexpected error occurred',
    });
  }
}