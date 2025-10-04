// /api/utils/validators.js

function validateCheckoutRequest(body) {
    const { userId, email, currency } = body;
    
    if (!userId || typeof userId !== 'string') {
        return { valid: false, error: 'userId is required and must be a string' };
    }
    
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
        return { valid: false, error: 'valid email is required' };
    }

    // 通貨バリデーション追加
    if (!currency || typeof currency !== 'string') {
        return { valid: false, error: 'currency is required' };
    }
    
    return { valid: true };
}

function validateWebhookPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Invalid payload' };
    }
    
    const { order_id, payment_status } = payload;
    
    if (!order_id || typeof order_id !== 'string') {
        return { valid: false, error: 'order_id is required' };
    }
    
    if (!payment_status || typeof payment_status !== 'string') {
        return { valid: false, error: 'payment_status is required' };
    }
    
    return { valid: true };
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function extractUserIdFromOrderId(orderId) {
    const match = orderId.match(/^sub_([^_]+)_/);
    if (!match) {
        throw new Error(`Invalid order_id format: ${orderId}`);
    }
    return match[1];
}

module.exports = {
    validateCheckoutRequest,
    validateWebhookPayload,
    extractUserIdFromOrderId,
    isValidEmail
};