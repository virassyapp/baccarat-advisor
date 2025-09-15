import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 環境変数の検証
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // リクエストボディの検証
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Creating checkout session for user:', userId);

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('User fetch error:', userError);
      return res.status(400).json({ error: 'User not found' });
    }

    let customerId = user.stripe_customer_id;

    // Stripe Customerが存在しない場合は作成
    if (!customerId) {
      console.log('Creating new Stripe customer for user:', userId);
      
      const customer = await stripe.customers.create({
        email: user.email,
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
    }

    // サクセスURLとキャンセルURLの設定
    const baseUrl = req.headers.origin || 
                    req.headers.referer?.replace(/\/$/, '') || 
                    `https://${req.headers.host}`;

    // Checkout Sessionの作成
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: 'バカラ戦略アドバイザー プレミアム',
              description: '高度な戦略アドバイス、リスク管理、詳細な分析機能',
            },
            unit_amount: 2980, // 2,980円
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

  } catch (error) {
    console.error('Checkout session creation error:', error);
    return res.status(500).json({
      error: 'Failed to create checkout session',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}