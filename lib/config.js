// /lib/config.js
/**
 * 環境変数を検証し、必要な設定が揃っているか確認
 */
class ConfigValidator {
    constructor() {
        this.requiredVars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'NOWPAYMENTS_API_KEY',
            'NOWPAYMENTS_IPN_SECRET'
        ];
    }

    validate() {
        const missing = this.requiredVars.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variables: ${missing.join(', ')}\n` +
                `Please configure them in Vercel dashboard.`
            );
        }
    }

    get supabase() {
        return {
            url: process.env.SUPABASE_URL,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
        };
    }

    get nowpayments() {
        return {
            apiKey: process.env.NOWPAYMENTS_API_KEY,
            ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
            apiUrl: process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1'
        };
    }

    get app() {
        return {
            domain: process.env.DOMAIN || process.env.VERCEL_URL,
            nodeEnv: process.env.NODE_ENV || 'production',
            isDevelopment: process.env.NODE_ENV === 'development'
        };
    }
}

const config = new ConfigValidator();

module.exports = { config };