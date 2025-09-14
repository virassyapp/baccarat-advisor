import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 環境変数の検証
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_PRICE_ID',
  'SUCCESS_URL',
  'CANCEL_URL'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  // 本番環境ではより堅牢なエラーハンドリングを推奨
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
  maxNetworkRetries: 2,
  timeout: 20000
});

// Supabase 管理者クライアント（バックエンド専用）
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Admin 権限キー
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted'
    });
  }

  try {
    // リクエストボディの検証
    if (!req.headers || !req.headers.authorization) {
      return res.status(401).json({ 
        error: '認証トークンが必要です',
        code: 'MISSING_AUTH_TOKEN'
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '無効な認証形式です',
        code: 'INVALID_AUTH_FORMAT'
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ 
        error: 'トークンが空です',
        code: 'EMPTY_TOKEN'
      });
    }

    // ユーザー認証
    let user;
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError) {
        console.error('Supabase auth error:', authError);
        return res.status(401).json({ 
          error: '認証エラーが発生しました',
          code: 'AUTH_ERROR',
          details: authError.message
        });
      }
      
      if (!userData || !userData.user) {
        return res.status(401).json({ 
          error: 'ユーザーが見つかりません',
          code: 'USER_NOT_FOUND'
        });
      }
      
      user = userData.user;
    } catch (authException) {
      console.error('Auth exception:', authException);
      return res.status(500).json({ 
        error: '認証処理中に例外が発生しました',
        code: 'AUTH_EXCEPTION'
      });
    }

    // 既存のサブスクリプションチェック
    try {
      const { data: existingUser, error: queryError } = await supabase
        .from('users')
        .select('is_subscribed, stripe_customer_id')
        .eq('id', user.id)
        .single();
      
      if (!queryError && existingUser && existingUser.is_subscribed) {
        return res.status(400).json({ 
          error: '既にサブスクリプションに登録されています',
          code: 'ALREADY_SUBSCRIBED'
        });
      }
    } catch (queryException) {
      console.error('Query exception:', queryException);
      // チェックに失敗しても処理は続行（新規作成として扱う）
    }

    // Stripe チェックアウトセッション作成
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.CANCEL_URL,
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          email: user.email
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            email: user.email
          }
        }
      }, {
        idempotencyKey: `checkout_${user.id}_${Date.now()}`
      });
    } catch (stripeError) {
      console.error('Stripe session creation error:', stripeError);
      
      // Stripeエラーの種類に応じた処理
      if (stripeError.type === 'StripeConnectionError') {
        return res.status(503).json({ 
          error: '決済サービスに接続できませんでした',
          code: 'STRIPE_CONNECTION_ERROR'
        });
      } else if (stripeError.type === 'StripeAPIError') {
        return res.status(502).json({ 
          error: '決済サービスでエラーが発生しました',
          code: 'STRIPE_API_ERROR',
          details: stripeError.message
        });
      } else {
        return res.status(500).json({ 
          error: 'チェックアウトセッションの作成に失敗しました',
          code: 'SESSION_CREATION_FAILED',
          details: stripeError.message
        });
      }
    }

    if (!session || !session.url) {
      return res.status(500).json({ 
        error: 'チェックアウトセッションの作成に失敗しました',
        code: 'INVALID_SESSION'
      });
    }

    res.status(200).json({ 
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    console.error('Unexpected error in create-checkout-session:', err);
    res.status(500).json({ 
      error: '内部サーバーエラーが発生しました',
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}