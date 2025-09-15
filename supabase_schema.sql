-- バカラ戦略アドバイザー用データベーススキーマ（簡略版）

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255),
    is_subscribed BOOLEAN DEFAULT FALSE,
    payment_failed BOOLEAN DEFAULT FALSE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    subscription_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(is_subscribed);

-- Row Level Security (RLS) の設定
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のデータのみアクセス可能
CREATE POLICY "Users can view own data" ON users
    FOR ALL USING (auth.uid() = id);

-- トリガー関数: updated_at自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ language 'plpgsql';

-- トリガー設定
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ユーザー作成時に自動でusersテーブルにレコード作成する関数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新規ユーザー作成トリガー
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- サブスクリプション状態確認用関数
CREATE OR REPLACE FUNCTION check_user_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM users 
        WHERE id = user_uuid 
        AND is_subscribed = TRUE
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE users IS 'ユーザー基本情報とサブスクリプション状態';
COMMENT ON COLUMN users.stripe_customer_id IS 'StripeのCustomer ID';
COMMENT ON COLUMN users.stripe_subscription_id IS 'StripeのSubscription ID';
COMMENT ON COLUMN users.is_subscribed IS 'サブスクリプション有効フラグ';
COMMENT ON COLUMN users.payment_failed IS '支払い失敗フラグ';
COMMENT ON COLUMN users.last_payment_date IS '最終支払い日時';
COMMENT ON COLUMN users.subscription_updated_at IS 'サブスクリプション更新日時';