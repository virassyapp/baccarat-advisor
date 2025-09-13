import Stripe from 'stripe';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // イベントタイプに応じた処理
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('✅ Checkout session completed:', session.id);
      // ここでDB更新などを行う
      await handleCheckoutSessionCompleted(session);
      break;
      
    case 'invoice.paid':
      // 定期支払いが成功した場合の処理
      await handleInvoicePaid(event.data.object);
      break;
      
    case 'invoice.payment_failed':
      // 支払い失敗時の処理
      await handlePaymentFailed(event.data.object);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
}

async function handleCheckoutSessionCompleted(session) {
  // ここでSupabaseなどにユーザーの課金ステータスを保存
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  
  // Supabaseに保存するコードを追加
  const { data, error } = await supabase
    .from('users')
    .update({ 
      is_subscribed: true,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId
    })
    .eq('email', session.customer_email);
}

async function handleInvoicePaid(invoice) {
  // 定期支払いが成功した場合の処理
}

async function handlePaymentFailed(invoice) {
  // 支払い失敗時の処理
}