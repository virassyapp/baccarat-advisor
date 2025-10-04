# Baccarat Strategy Advisor

Statistical learning system for baccarat pattern analysis.

## Features

- Google Authentication (Supabase Auth)
- Cryptocurrency subscription payments (NowPayments)
- Multi-language support (Japanese, English, Spanish, Chinese, Korean, French)
- Real-time pattern analysis
- Risk management system

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables in Vercel dashboard
4. Deploy to Vercel: `vercel --prod`

## Environment Variables

Required environment variables (set in Vercel dashboard):

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `NOWPAYMENTS_API_KEY`: NowPayments API key
- `NOWPAYMENTS_IPN_SECRET`: NowPayments IPN secret for webhook verification
- `DOMAIN`: Your application domain

## Local Development
```bash
npm run dev