// /lib/nowpayments/signature.js
const crypto = require('crypto');

function sortObject(obj) {
    return Object.keys(obj)
        .sort()
        .reduce((result, key) => {
            result[key] = obj[key];
            return result;
        }, {});
}

function verifyIPNSignature(payload, signature, secret) {
    if (!secret) {
        throw new Error('NOWPAYMENTS_IPN_SECRET is not configured');
    }
    
    const hmac = crypto.createHmac('sha512', secret);
    const sortedPayload = JSON.stringify(sortObject(payload));
    hmac.update(sortedPayload);
    const calculatedSignature = hmac.digest('hex');
    
    console.log('Signature verification:', {
        received: signature,
        calculated: calculatedSignature,
        match: calculatedSignature === signature
    });
    
    return calculatedSignature === signature;
}

module.exports = { verifyIPNSignature, sortObject };