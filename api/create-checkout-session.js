// /api/create-checkout-session.js
const { getSupabaseClient } = require('./utils/supabase');
const { validateCheckoutRequest } = require('./utils/validators');
const { APIError, handleAPIError } = require('./utils/errors');
const { createRecurringInvoice } = require('../lib/nowpayments/client');
const { getUserById, createUser, updateUserInvoice } = require('../lib/supabase/queries');
const { SUPPORTED_CURRENCIES } = require('../lib/constants');

module.exports = async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return handleAPIError(
            new APIError('Method not allowed', 405, 'METHOD_NOT_ALLOWED'),
            res
        );
    }

    try {
        // リクエストバリデーション
        const validation = validateCheckoutRequest(req.body);
        if (!validation.valid) {
            throw new APIError(validation.error, 400, 'VALIDATION_ERROR');
        }

        const { userId, email, currency } = req.body;

        // 通貨バリデーション
        if (!currency) {
            throw new APIError('Currency is required', 400, 'MISSING_CURRENCY');
        }

        const isSupportedCurrency = SUPPORTED_CURRENCIES.some(c => c.code === currency.toLowerCase());
        if (!isSupportedCurrency) {
            throw new APIError(
                `Currency ${currency} is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.map(c => c.code).join(', ')}`,
                400,
                'UNSUPPORTED_CURRENCY'
            );
        }

        console.log('Creating recurring checkout session for:', { userId, email, currency });

        // Supabase接続
        const supabase = getSupabaseClient();

        // ユーザーレコード確認・作成
        const { data: existingUser, error: fetchError } = await getUserById(supabase, userId);

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Database fetch error:', fetchError);
            throw new APIError('Database error', 500, 'DB_ERROR', fetchError);
        }

        if (!existingUser) {
            console.log('Creating user record...');
            const { error: insertError } = await createUser(supabase, userId, email);
        
            if (insertError) {
                console.error('Failed to create user record:', insertError);
                // 詳細なエラー情報を返す
                throw new APIError(
                    `Failed to create user record: ${insertError.message || insertError.code}`, 
                    500, 
                    'USER_CREATION_ERROR',
                    insertError
                );
            }
        }

        // NowPayments Recurring Invoice作成
        const domain = process.env.DOMAIN || req.headers.origin;
        const apiKey = process.env.NOWPAYMENTS_API_KEY;
        
        const invoice = await createRecurringInvoice(
            userId, 
            email, 
            currency.toLowerCase(), 
            domain, 
            apiKey
        );

        // InvoiceIDをユーザーレコードに保存
        const { error: updateError } = await updateUserInvoice(
            supabase, 
            userId, 
            invoice, 
            currency.toLowerCase()
        );

        if (updateError) {
            console.error('Failed to update invoice ID:', updateError);
        }

        res.status(200).json({
            id: invoice.id,
            url: invoice.invoice_url || invoice.payment_url,
            order_id: invoice.order_id,
            currency: currency.toLowerCase(),
            plan: 'monthly'
        });

    } catch (error) {
        return handleAPIError(error, res);
    }
};