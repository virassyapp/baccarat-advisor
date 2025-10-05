// /api/create-checkout-session.js

export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userId, email, currency } = req.body;

        // バリデーション
        if (!userId || !email || !currency) {
            return res.status(400).json({ 
                error: 'Missing required fields: userId, email, currency' 
            });
        }

        // 環境変数チェック
        if (!process.env.NOWPAYMENTS_API_KEY) {
            console.error('NOWPAYMENTS_API_KEY is not set');
            return res.status(500).json({ 
                error: 'Server configuration error: Payment API key not configured' 
            });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('Supabase credentials not set');
            return res.status(500).json({ 
                error: 'Server configuration error: Database credentials not configured' 
            });
        }

        console.log('Creating checkout session:', { userId, email, currency });

        // NowPayments APIリクエスト
        const domain = process.env.DOMAIN || req.headers.origin || 'https://baccarat-advisor-tau.vercel.app';
        
        const invoiceData = {
            price_amount: 100,
            price_currency: 'usd',
            pay_currency: currency.toLowerCase(),
            order_id: `${userId}_${Date.now()}`,
            order_description: 'Baccarat Advisor Monthly Subscription',
            ipn_callback_url: `${domain}/api/webhook`,
            success_url: `${domain}/?payment=success`,
            cancel_url: `${domain}/?payment=cancelled`,
            is_fixed_rate: true,
            is_fee_paid_by_user: false
        };

        const response = await fetch('https://api.nowpayments.io/v1/invoice', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.NOWPAYMENTS_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoiceData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('NowPayments API error:', response.status, errorText);
            return res.status(500).json({ 
                error: 'Payment provider error',
                details: errorText 
            });
        }

        const invoice = await response.json();

        res.status(200).json({
            id: invoice.id,
            url: invoice.invoice_url,
            order_id: invoice.order_id,
            currency: currency.toLowerCase()
        });

    } catch (error) {
        console.error('Checkout session error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}