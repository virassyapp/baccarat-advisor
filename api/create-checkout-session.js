import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log('Received webhook event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log('Processing checkout session completed:', session.id);
  
  const userId = session.client_reference_id || session.metadata?.userId;
  const customerId = session.customer;
  
  if (!userId) {
    console.error('No user ID found in checkout session');
    return;
  }

  try {
    // ユーザー情報を更新
    const { error: updateError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        stripe_customer_id: customerId,
        is_subscribed: true,
        subscription_status: 'active',
        subscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (updateError) {
      console.error('Failed to update user subscription status:', updateError);
      return;
    }

    // サブスクリプション詳細を取得して保存
    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      
      await supabase
        .from('subscriptions')
        .upsert({
          id: subscription.id,
          user_id: userId,
          customer_id: customerId,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          created_at: new Date(subscription.created * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });
    }

    console.log(`Successfully updated subscription for user ${userId}`);
  } catch (error) {
    console.error('Error updating user subscription:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Processing invoice payment succeeded:', invoice.id);
  
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    console.log('No subscription ID found in invoice');
    return;
  }

  try {
    // サブスクリプション情報を更新
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    if (error) {
      console.error('Failed to update subscription:', error);
      return;
    }

    // ユーザーの状態も更新
    await supabase
      .from('users')
      .update({
        is_subscribed: true,
        subscription_status: subscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', customerId);

    console.log(`Successfully processed payment for subscription ${subscriptionId}`);
  } catch (error) {
    console.error('Error processing invoice payment:', error);
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Processing subscription created:', subscription.id);
  
  const customerId = subscription.customer;
  const userId = subscription.metadata?.userId;

  try {
    await supabase
      .from('subscriptions')
      .upsert({
        id: subscription.id,
        user_id: userId,
        customer_id: customerId,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        created_at: new Date(subscription.created * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    console.log(`Successfully created subscription record for ${subscription.id}`);
  } catch (error) {
    console.error('Error creating subscription record:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Processing subscription updated:', subscription.id);
  
  const customerId = subscription.customer;

  try {
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // ユーザー状態も更新
    const isActive = ['active', 'trialing'].includes(subscription.status);
    await supabase
      .from('users')
      .update({
        is_subscribed: isActive,
        subscription_status: subscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', customerId);

    console.log(`Successfully updated subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Processing subscription deleted:', subscription.id);
  
  const customerId = subscription.customer;

  try {
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // ユーザーのサブスクリプション状態を無効化
    await supabase
      .from('users')
      .update({
        is_subscribed: false,
        subscription_status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', customerId);

    console.log(`Successfully canceled subscription ${subscription.id}`);
  } catch (error) {
    console.error('Error canceling subscription:', error);
  }
}

async function handlePaymentFailed(invoice) {
  console.log('Processing payment failed:', invoice.id);
  
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  try {
    // 支払い失敗をログに記録
    await supabase
      .from('payment_failures')
      .insert({
        user_id: null, // customer_idから後で解決
        customer_id: customerId,
        subscription_id: subscriptionId,
        invoice_id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        failure_reason: invoice.last_finalization_error?.message || 'Payment failed',
        created_at: new Date().toISOString()
      });

    // 一定回数失敗した場合はサブスクリプションを一時停止
    if (invoice.attempt_count >= 3) {
      await supabase
        .from('users')
        .update({
          subscription_status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_customer_id', customerId);
    }

    console.log(`Successfully processed payment failure for invoice ${invoice.id}`);
  } catch (error) {
    console.error('Error processing payment failure:', error);
  }
}