// /public/assets/js/utils/api.js

/**
 * チェックアウトセッション作成(通貨選択対応)
 */
async function createCheckoutSession(userId, email, currency = 'btc') {
    try {
        const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId, 
                email,
                currency: currency.toLowerCase()
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Checkout session creation error:', error);
        throw error;
    }
}

/**
 * ユーザーのサブスクリプション状態確認(有効期限チェック付き)
 */
async function checkUserSubscription(supabase, userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('is_subscribed, subscription_status, subscription_expires_at, payment_status, updated_at')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Subscription check error:', error);
            return { isSubscribed: false, error };
        }

        const now = new Date();
        const expiresAt = data.subscription_expires_at ? new Date(data.subscription_expires_at) : null;

        let isSubscribed = false;
        let isExpired = false;

        if (data.subscription_status === 'active' && expiresAt) {
            if (expiresAt > now) {
                isSubscribed = true;
            } else {
                isExpired = true;
                await expireUserSubscription(supabase, userId);
            }
        }

        return { 
            isSubscribed, 
            isExpired,
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            data 
        };
    } catch (error) {
        console.error('Subscription check failed:', error);
        return { isSubscribed: false, error };
    }
}

/**
 * 期限切れサブスクリプションを無効化
 */
async function expireUserSubscription(supabase, userId) {
    try {
        const { error } = await supabase
            .from('users')
            .update({
                is_subscribed: false,
                subscription_status: 'expired',
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('Failed to expire subscription:', error);
        } else {
            console.log('Subscription expired for user:', userId);
        }
    } catch (error) {
        console.error('Error expiring subscription:', error);
    }
}