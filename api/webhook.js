// /api/webhook.js
import { buffer } from 'micro';
import { getSupabaseClient } from './utils/supabase';
import { validateWebhookPayload, extractUserIdFromOrderId } from './utils/validators';
import { APIError, handleAPIError } from './utils/errors';
import { verifyIPNSignature } from '../lib/nowpayments/signature';
import { PAYMENT_STATUSES } from '../lib/constants';
import {
    updateUserPaymentSuccess,
    updateUserPaymentFailed,
    updateUserPaymentPartial,
    updateUserPaymentPending
} from '../lib/supabase/queries';

export const config = {
    api: {
        bodyParser: false,
    },
};

// 重複リクエスト防止用キャッシュ
const processedWebhooks = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return handleAPIError(
            new APIError('Method Not Allowed', 405, 'METHOD_NOT_ALLOWED'),
            res
        );
    }

    try {
        // 署名取得
        const signature = req.headers['x-nowpayments-sig'];
        if (!signature) {
            throw new APIError('IPN signature is missing', 400, 'MISSING_SIGNATURE');
        }

        // リクエストボディ読み取り
        let payload;
        try {
            const buf = await buffer(req);
            payload = JSON.parse(buf.toString('utf8'));
        } catch (error) {
            throw new APIError('Invalid JSON payload', 400, 'INVALID_JSON');
        }

        console.log('Received webhook payload:', payload);

        // ペイロードバリデーション
        const validation = validateWebhookPayload(payload);
        if (!validation.valid) {
            throw new APIError(validation.error, 400, 'INVALID_PAYLOAD');
        }

        // 重複チェック
        const webhookId = `${payload.order_id}_${payload.payment_status}_${payload.payment_id || Date.now()}`;
        if (processedWebhooks.has(webhookId)) {
            console.log(`Duplicate webhook ignored: ${webhookId}`);
            return res.status(200).json({ received: true, duplicate: true });
        }

        // IPN署名検証
        const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
        if (!verifyIPNSignature(payload, signature, ipnSecret)) {
            throw new APIError(
                'IPN signature verification failed',
                400,
                'SIGNATURE_VERIFICATION_FAILED'
            );
        }

        console.log('✅ IPN signature verified');

        // ペイロード処理
        const supabase = getSupabaseClient();
        await processWebhook(supabase, payload);

        // キャッシュに追加
        processedWebhooks.set(webhookId, Date.now());
        cleanupCache();

        res.status(200).json({
            received: true,
            order_id: payload.order_id,
            payment_status: payload.payment_status
        });

    } catch (error) {
        return handleAPIError(error, res);
    }
}

function cleanupCache() {
    const now = Date.now();
    for (const [key, timestamp] of processedWebhooks.entries()) {
        if (now - timestamp > CACHE_DURATION) {
            processedWebhooks.delete(key);
        }
    }
}

async function processWebhook(supabase, payload) {
    const { payment_status, order_id, invoice_id } = payload;

    // userIdを抽出
    const userId = extractUserIdFromOrderId(order_id);
    console.log(`Processing payment for user: ${userId}, status: ${payment_status}`);

    // ステータス別処理
    switch (payment_status) {
        case PAYMENT_STATUSES.FINISHED:
        case PAYMENT_STATUSES.CONFIRMED:
            await handlePaymentSuccess(supabase, userId, invoice_id, payload);
            break;

        case PAYMENT_STATUSES.FAILED:
        case PAYMENT_STATUSES.EXPIRED:
            await handlePaymentFailed(supabase, userId, payload);
            break;

        case PAYMENT_STATUSES.PARTIALLY_PAID:
            await handlePaymentPartial(supabase, userId, payload);
            break;

        case PAYMENT_STATUSES.WAITING:
        case PAYMENT_STATUSES.SENDING:
            await handlePaymentPending(supabase, userId, payload);
            break;

        default:
            console.log(`Unhandled payment status: ${payment_status}`);
    }
}

async function handlePaymentSuccess(supabase, userId, invoiceId, payload) {
    const { error, expiresAt } = await updateUserPaymentSuccess(
        supabase, 
        userId, 
        invoiceId, 
        payload
    );

    if (error) {
        throw new APIError(
            `Database update failed: ${error.message}`,
            500,
            'DB_UPDATE_FAILED'
        );
    }

    console.log(`✅ Payment success processed for user: ${userId}`);
    console.log(`📅 New subscription expires at: ${expiresAt.toISOString()}`);
}

async function handlePaymentFailed(supabase, userId, payload) {
    const { error } = await updateUserPaymentFailed(supabase, userId, payload);

    if (error) {
        throw new APIError(
            `Payment failure update failed: ${error.message}`,
            500,
            'DB_UPDATE_FAILED'
        );
    }

    console.log(`✅ Payment failure processed for user: ${userId}`);
}

async function handlePaymentPartial(supabase, userId, payload) {
    await updateUserPaymentPartial(supabase, userId, payload);
    console.log(`⚠️ Partial payment for user: ${userId}`);
}

async function handlePaymentPending(supabase, userId, payload) {
    await updateUserPaymentPending(supabase, userId, payload);
    console.log(`ℹ️ Payment pending for user: ${userId}`);
}