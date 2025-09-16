import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

// 環境変数の検証
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is required');
}
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  maxNetworkRetries: 3,
  timeout: 30000
});

// Supabase 管理者クライアント
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

// イベント処理のリトライ設定
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, operationName, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`${operationName} attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        await delay(RETRY_DELAY * attempt);
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError.message}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      message: 'Only POST requests are accepted'
    });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ 
      error: 'Stripe signature is missing',
      code: 'MISSING_SIGNATURE'
    });
  }

  let buf;
  try {
    buf = await buffer(req);
  } catch (bufferError) {
    console.error('Buffer error:', bufferError);
    return res.status(400).json({ 
      error: 'Failed to read request body',
      code: 'BODY_READ_ERROR'
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ 
      error: `Webhook Error: ${err.message}`,
      code: 'SIGNATURE_VERIFICATION_FAILED'
    });
  }

  // イベントタイプに応じた処理
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('✅ Checkout session completed:', session.id);

        const userId = session.metadata?.userId;
        if (!userId) {
          console.error('ユーザーIDが見つかりませんでした', session);
          // ユーザーIDがない場合はエラーだが、処理は続行
          break;
        }

        await withRetry(
          () => handleCheckoutSessionCompleted(session, userId),
          'handleCheckoutSessionCompleted'
        );
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        if (!customerId) {
          console.error('顧客IDが見つかりませんでした', invoice);
          break;
        }

        await withRetry(
          () => handleInvoicePaid(invoice, customerId),
          'handleInvoicePaid'
        );
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object;
        const failedCustomerId = failedInvoice.customer;
        
        if (!failedCustomerId) {
          console.error('失敗した顧客IDが見つかりませんでした', failedInvoice);
          break;
        }

        await withRetry(
          () => handlePaymentFailed(failedInvoice, failedCustomerId),
          'handlePaymentFailed'
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subCustomerId = subscription.customer;
        
        if (!subCustomerId) {
          console.error('サブスクリプション顧客IDが見つかりませんでした', subscription);
          break;
        }

        await withRetry(
          () => handleSubscriptionCancelled(subscription, subCustomerId),
          'handleSubscriptionCancelled'
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const subCustomerId = subscription.customer;
        
        if (!subCustomerId) {
          console.error('更新サブスクリプション顧客IDが見つかりませんでした', subscription);
          break;
        }

        await withRetry(
          () => handleSubscriptionUpdated(subscription, subCustomerId),
          'handleSubscriptionUpdated'
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        // 未処理のイベントタイプでも200を返す（Stripeの要件）
    }

    res.status(200).json({ 
      received: true,
      eventId: event.id,
      eventType: event.type
    });
  } catch (processingError) {
    console.error('Webhook processing error:', processingError);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      code: 'PROCESSING_ERROR',
      message: process.env.NODE_ENV === 'development' ? processingError.message : undefined
    });
  }
}

async function handleCheckoutSessionCompleted(session, userId) {
  try {
    const customerId = session.customer;
    const subscriptionId = session.subscription;

    if (!customerId || !subscriptionId) {
      throw new Error('Missing customerId or subscriptionId in session');
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_subscribed: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('ユーザー更新エラー:', error);
      throw new Error(`Database update failed: ${error.message}`);
    }

    console.log('✅ User subscription updated successfully:', userId);
  } catch (error) {
    console.error('Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
}

async function handleInvoicePaid(invoice, customerId) {
  try {
    // 顧客IDからユーザーを検索
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (queryError) {
      console.error('ユーザー検索エラー:', queryError);
      throw new Error(`User query failed: ${queryError.message}`);
    }

    if (!user) {
      console.error('顧客IDに対応するユーザーが見つかりませんでした:', customerId);
      return; // ユーザーが見つからない場合は処理を終了
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_subscribed: true,
        last_payment_date: new Date().toISOString(),
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('インボイス支払い処理エラー:', error);
      throw new Error(`Invoice payment update failed: ${error.message}`);
    }

    console.log('✅ Invoice payment processed successfully for user:', user.id);
  } catch (error) {
    console.error('Error in handleInvoicePaid:', error);
    throw error;
  }
}

async function handlePaymentFailed(invoice, customerId) {
  try {
    // 顧客IDからユーザーを検索
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (queryError) {
      console.error('ユーザー検索エラー:', queryError);
      throw new Error(`User query failed: ${queryError.message}`);
    }

    if (!user) {
      console.error('顧客IDに対応するユーザーが見つかりませんでした:', customerId);
      return; // ユーザーが見つからない場合は処理を終了
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_subscribed: false,
        payment_failed: true,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('支払い失敗処理エラー:', error);
      throw new Error(`Payment failure update failed: ${error.message}`);
    }

    console.log('✅ Payment failure processed for user:', user.id);
  } catch (error) {
    console.error('Error in handlePaymentFailed:', error);
    throw error;
  }
}

async function handleSubscriptionCancelled(subscription, customerId) {
  try {
    // 顧客IDからユーザーを検索
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (queryError) {
      console.error('ユーザー検索エラー:', queryError);
      throw new Error(`User query failed: ${queryError.message}`);
    }

    if (!user) {
      console.error('顧客IDに対応するユーザーが見つかりませんでした:', customerId);
      return; // ユーザーが見つからない場合は処理を終了
    }

    const { error } = await supabase
      .from('users')
      .update({
        is_subscribed: false,
        stripe_subscription_id: null,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('サブスクリプションキャンセル処理エラー:', error);
      throw new Error(`Subscription cancellation update failed: ${error.message}`);
    }

    console.log('✅ Subscription cancelled for user:', user.id);
  } catch (error) {
    console.error('Error in handleSubscriptionCancelled:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription, customerId) {
  try {
    // 顧客IDからユーザーを検索
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (queryError) {
      console.error('ユーザー検索エラー:', queryError);
      throw new Error(`User query failed: ${queryError.message}`);
    }

    if (!user) {
      console.error('顧客IDに対応するユーザーが見つかりませんでした:', customerId);
      return; // ユーザーが見つからない場合は処理を終了
    }

    const isActive = subscription.status === 'active';
    
    const { error } = await supabase
      .from('users')
      .update({
        is_subscribed: isActive,
        subscription_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('サブスクリプション更新処理エラー:', error);
      throw new Error(`Subscription update failed: ${error.message}`);
    }

    console.log(`✅ Subscription ${isActive ? 'activated' : 'deactivated'} for user:`, user.id);
  } catch (error) {
    console.error('Error in handleSubscriptionUpdated:', error);
    throw error;
  }
}