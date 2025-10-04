// /lib/supabase/queries.js

/**
 * ユーザーIDでユーザー情報を取得
 */
async function getUserById(supabase, userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    return { data, error };
}

/**
 * 新規ユーザー作成
 */
async function createUser(supabase, userId, email) {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([
                {
                    id: userId,
                    email: email,
                    is_subscribed: false,
                    subscription_status: 'inactive',
                    subscription_plan: 'monthly',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Insert error details:', error);
            return { data: null, error };
        }

        console.log('User created successfully:', userId);
        return { data, error: null };
        
    } catch (error) {
        console.error('Create user exception:', error);
        return { data: null, error };
    }
}

/**
 * サブスクリプション成功時の更新（有効期限を設定）
 * 既存の有効期限がある場合は延長、ない場合は新規作成
 */
async function updateUserPaymentSuccess(supabase, userId, invoiceId, payload) {
    try {
        // 現在のユーザー情報を取得
        const { data: currentUser } = await getUserById(supabase, userId);
        
        const now = new Date();
        let expiresAt;

        // 既存の有効期限がある場合の処理
        if (currentUser?.subscription_expires_at) {
            const existingExpiry = new Date(currentUser.subscription_expires_at);
            
            // 既存の有効期限がまだ未来の場合は、その日付から+1ヶ月
            if (existingExpiry > now) {
                expiresAt = new Date(existingExpiry);
                expiresAt.setMonth(expiresAt.getMonth() + 1);
                console.log(`📅 Extending existing subscription from ${existingExpiry.toISOString()} to ${expiresAt.toISOString()}`);
            } else {
                // 期限切れの場合は今日から+1ヶ月
                expiresAt = new Date(now);
                expiresAt.setMonth(expiresAt.getMonth() + 1);
            }
        } else {
            // 新規サブスクリプションの場合は今日から+1ヶ月
            expiresAt = new Date(now);
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        const { error } = await supabase
            .from('users')
            .update({
                is_subscribed: true,
                subscription_status: 'active',
                subscription_expires_at: expiresAt.toISOString(),
                subscription_started_at: currentUser?.subscription_started_at || now.toISOString(), // 初回のみ記録
                last_payment_date: now.toISOString(),
                subscription_plan: 'monthly',
                recurring_invoice_id: invoiceId,
                nowpayments_invoice_id: invoiceId,
                payment_status: 'success',
                payment_details: payload, // JSONBなのでそのまま
                updated_at: now.toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('❌ Error updating user payment info:', error);
            throw error;
        }

        console.log(`✅ Payment success processed for user: ${userId}`);
        console.log(`📅 Subscription expires at: ${expiresAt.toISOString()}`);

        return { error: null, expiresAt };
        
    } catch (error) {
        console.error('Error in updateUserPaymentSuccess:', error);
        return { error };
    }
}

/**
 * 支払い失敗時の更新
 */
async function updateUserPaymentFailed(supabase, userId, payload) {
    const { error } = await supabase
        .from('users')
        .update({
            payment_status: 'failed',
            payment_details: payload,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    return { error };
}

/**
 * 一部支払い時の更新
 */
async function updateUserPaymentPartial(supabase, userId, payload) {
    const { error } = await supabase
        .from('users')
        .update({
            payment_status: 'partially_paid',
            payment_details: payload,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    return { error };
}

/**
 * 支払い待機中の更新
 */
async function updateUserPaymentPending(supabase, userId, payload) {
    const { error } = await supabase
        .from('users')
        .update({
            payment_status: 'pending',
            payment_details: payload,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    return { error };
}

/**
 * Invoice情報の更新
 */
async function updateUserInvoice(supabase, userId, invoiceData, selectedCurrency) {
    const { error } = await supabase
        .from('users')
        .update({
            recurring_invoice_id: invoiceData.id,
            nowpayments_order_id: invoiceData.order_id,
            nowpayments_invoice_id: invoiceData.id,
            selected_currency: selectedCurrency,
            payment_status: 'pending',
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    return { error };
}

/**
 * 期限切れサブスクリプションを無効化
 */
async function expireSubscription(supabase, userId) {
    const { error } = await supabase
        .from('users')
        .update({
            is_subscribed: false,
            subscription_status: 'expired',
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    return { error };
}

/**
 * 有効期限チェックと更新
 */
async function checkAndUpdateExpiredSubscriptions(supabase, userId) {
    const { data: user, error: fetchError } = await getUserById(supabase, userId);
    
    if (fetchError || !user) {
        return { error: fetchError };
    }

    // 有効期限チェック
    if (user.subscription_expires_at) {
        const expiresAt = new Date(user.subscription_expires_at);
        const now = new Date();

        if (expiresAt < now && user.subscription_status === 'active') {
            // 期限切れなので無効化
            await expireSubscription(supabase, userId);
            return { isExpired: true, user };
        }
    }

    return { isExpired: false, user };
}

module.exports = {
    getUserById,
    createUser,
    updateUserPaymentSuccess,
    updateUserPaymentFailed,
    updateUserPaymentPartial,
    updateUserPaymentPending,
    updateUserInvoice,
    expireSubscription,
    checkAndUpdateExpiredSubscriptions
};