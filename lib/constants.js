// /lib/constants.js

// NowPayments API設定
const NOWPAYMENTS_API_URL = 'https://api.nowpayments.io/v1';
const NOWPAYMENTS_RECURRING_API_URL = 'https://api.nowpayments.io/v1/subscriptions';

// サブスクリプションプラン
const SUBSCRIPTION_PLANS = {
    monthly: {
        name: 'Monthly Premium',
        price: 500, //USD
        currency: 'usd',
        interval: 'month',
        intervalCount: 1,
        description: 'Baccarat Strategy Advisor Premium - Monthly Subscription'
    }
};

// 支払いステータス
const PAYMENT_STATUSES = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    PARTIALLY_PAID: 'partially_paid',
    FINISHED: 'finished',
    CONFIRMED: 'confirmed',
    EXPIRED: 'expired',
    WAITING: 'waiting',
    SENDING: 'sending'
};

// サブスクリプションステータス
const SUBSCRIPTION_STATUSES = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
};

// サポートされる暗号通貨
const SUPPORTED_CURRENCIES = [
    { code: 'btc', name: 'Bitcoin', symbol: '₿' },
    { code: 'eth', name: 'Ethereum', symbol: 'Ξ' },
    { code: 'usdt', name: 'Tether', symbol: '₮' },
    { code: 'usdc', name: 'USD Coin', symbol: '$' },
    { code: 'ltc', name: 'Litecoin', symbol: 'Ł' },
    { code: 'trx', name: 'Tron', symbol: 'T' },
    { code: 'bnb', name: 'Binance Coin', symbol: 'BNB' },
    { code: 'sol', name: 'Solana', symbol: 'SOL' }
];

// 有効期限の計算
function calculateExpiryDate(fromDate = new Date(), months = 1) {
    const expiryDate = new Date(fromDate);
    expiryDate.setMonth(expiryDate.getMonth() + months);
    return expiryDate;
}

// 有効期限チェック
function isSubscriptionExpired(expiresAt) {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date();
}

// 期限切れまでの日数
function daysUntilExpiry(expiresAt) {
    if (!expiresAt) return 0;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

module.exports = {
    NOWPAYMENTS_API_URL,
    NOWPAYMENTS_RECURRING_API_URL,
    SUBSCRIPTION_PLANS,
    PAYMENT_STATUSES,
    SUBSCRIPTION_STATUSES,
    SUPPORTED_CURRENCIES,
    calculateExpiryDate,
    isSubscriptionExpired,
    daysUntilExpiry
};