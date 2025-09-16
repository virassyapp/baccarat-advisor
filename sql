-- 1. RLSを有効化
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. 既存のポリシーを削除（もしあれば）
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;
DROP POLICY IF EXISTS "Public can insert users" ON public.users;

-- 3. 新しいセキュリティポリシーを作成

-- ユーザーは自分のプロフィールのみ閲覧可能
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT 
USING (auth.uid() = id);

-- ユーザーは自分のプロフィールのみ更新可能
CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE 
USING (auth.uid() = id);

-- サービスロールは全てのユーザーレコードを管理可能（Webhook用）
CREATE POLICY "Service role can manage all users" ON public.users
FOR ALL 
USING (auth.role() = 'service_role');

-- 新規ユーザー登録時のINSERT権限（認証済みユーザーのみ）
CREATE POLICY "Authenticated users can insert their own profile" ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. テーブル権限を確認・設定
-- 通常のユーザー（authenticated role）
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT INSERT ON public.users TO authenticated;

-- 匿名ユーザー（anon role）には最小限の権限のみ
REVOKE ALL ON public.users FROM anon;

-- サービスロール（service_role）は全権限
GRANT ALL ON public.users TO service_role;

-- 5. テーブル構造の確認（必要に応じて調整）
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- 6. インデックスの追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);

-- 7. セキュリティ検証用クエリ
-- 現在のRLS状態を確認
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users' AND schemaname = 'public';

-- 設定されているポリシーを確認
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND schemaname = 'public';