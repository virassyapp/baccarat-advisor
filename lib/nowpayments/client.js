// /lib/nowpayments/client.js
const { NOWPAYMENTS_RECURRING_API_URL, SUBSCRIPTION_PLANS } = require('../constants');

/**
 * NowPayments Recurring Invoice (サブスクリプション) を作成
 */
async function createRecurringInvoice(userId, email, selectedCurrency, domain, apiKey) {
    if (!apiKey) {
        throw new Error('NOWPAYMENTS_API_KEY is not configured');
    }

    const plan = SUBSCRIPTION_PLANS.monthly;
    const orderId = `sub_${userId}_${Date.now()}`;

    const subscriptionData = {
        title: plan.name,
        description: plan.description,
        price_amount: plan.price,
        price_currency: plan.currency,
        pay_currency: selectedCurrency, // ユーザーが選択した通貨
        order_id: orderId,
        ipn_callback_url: `${domain}/api/webhook`,
        success_url: `${domain}?success=true`,
        cancel_url: `${domain}?cancelled=true`,
        
        // Recurring設定
        is_recurring: true,
        charge_frequency: 'monthly', // 毎月請求
        auto_renew: false, // 半自動（ユーザーが毎回支払う）
        
        // 追加情報
        customer_email: email,
        
        // 固定レート設定（オプション）
        is_fixed_rate: false,
        is_fee_paid_by_user: false
    };

    console.log('Creating NowPayments recurring invoice:', {
        ...subscriptionData,
        userId,
        email
    });

    const response = await fetch(`${NOWPAYMENTS_RECURRING_API_URL}/plans`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(subscriptionData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('NowPayments API error:', errorText);
        throw new Error(`NowPayments API error: ${response.status} - ${errorText}`);
    }

    const invoice = await response.json();
    console.log('NowPayments recurring invoice created:', invoice.id);

    return invoice;
}

/**
 * 既存のRecurring Invoiceを取得
 */
async function getRecurringInvoice(invoiceId, apiKey) {
    const response = await fetch(`${NOWPAYMENTS_RECURRING_API_URL}/plans/${invoiceId}`, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch recurring invoice: ${response.status}`);
    }

    return await response.json();
}

module.exports = {
    createRecurringInvoice,
    getRecurringInvoice
};