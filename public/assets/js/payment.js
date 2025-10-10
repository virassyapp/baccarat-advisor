// /public/assets/js/payment.js

/**
 * サブスクリプション作成（通貨選択付き）
 */
async function handleSubscription(authManager, selectedCurrency = 'btc') {
    try {
        const { data: { user }, error: userError } = await authManager.supabase.auth.getUser();
        if (userError || !user) {
            alert('ログインしてください');
            return;
        }

        console.log('Initiating subscription for user:', user.email, 'Currency:', selectedCurrency);

        // ユーザーレコード作成を試行
        await createUserIfNotExists(authManager.supabase, user);

        // 通貨を含めてセッション作成
        const session = await createCheckoutSession(user.id, user.email, selectedCurrency);

        if (session.error) {
            throw new Error(session.error);
        }

        if (session.url) {
            // NowPaymentsの決済ページへリダイレクト
            window.location.href = session.url;
        } else {
            throw new Error('セッションURLがありません');
        }
    } catch (error) {
        console.error('Subscription error:', error);
        alert('サブスクリプションの開始に失敗しました: ' + error.message);
    }
}

/**
 * 通貨選択UI表示
 */
function showCurrencySelector(authManager) {
    const currencies = [
        { code: 'btc', name: 'Bitcoin', symbol: '₿' },
        { code: 'eth', name: 'Ethereum', symbol: 'Ξ' },
        { code: 'usdterc20', name: 'Tether (ERC20)', symbol: '₮' },
        { code: 'usdttrc20', name: 'Tether (TRC20)', symbol: '₮' },
        { code: 'usdc', name: 'USD Coin', symbol: '$' },
        { code: 'ltc', name: 'Litecoin', symbol: 'Ł' },
        { code: 'trx', name: 'Tron', symbol: 'T' },
        { code: 'bnb', name: 'Binance Coin', symbol: 'BNB' },
        { code: 'sol', name: 'Solana', symbol: 'SOL' }
    ];

    // モーダルHTML生成
    const modalHTML = `
        <div class="currency-modal" id="currencyModal">
            <div class="currency-modal-content">
                <h2>Select Payment Currency</h2>
                <p class="modal-description">Choose the cryptocurrency to pay the monthly $9.9 subscription.</p>
                <div class="currency-grid">
                    ${currencies.map(currency => `
                        <button class="currency-option" data-currency="${currency.code}">
                            <span class="currency-symbol">${currency.symbol}</span>
                            <span class="currency-name">${currency.name}</span>
                            <span class="currency-code">${currency.code.toUpperCase()}</span>
                        </button>
                    `).join('')}
                </div>
                <button class="btn-close-modal" id="closeCurrencyModal">キャンセル</button>
            </div>
        </div>
    `;

    // モーダルを追加
    const existingModal = document.getElementById('currencyModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // イベントリスナー
    document.querySelectorAll('.currency-option').forEach(button => {
        button.addEventListener('click', () => {
            const selectedCurrency = button.dataset.currency;
            document.getElementById('currencyModal').remove();
            handleSubscription(authManager, selectedCurrency);
        });
    });

    document.getElementById('closeCurrencyModal').addEventListener('click', () => {
        document.getElementById('currencyModal').remove();
    });
}

/**
 * ユーザーレコード作成
 */
async function createUserIfNotExists(supabase, user) {
    try {
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!existingUser) {
            console.log('Creating user record...');
            await supabase
                .from('users')
                .insert([
                    {
                        id: user.id,
                        email: user.email,
                        is_subscribed: false,
                        subscription_status: 'inactive',
                        subscription_plan: 'monthly',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ]);
        }
    } catch (error) {
        console.error('Error in createUserIfNotExists:', error);
    }
}

/**
 * 手動サブスクリプション更新（開発/テスト用）
 */
async function manualSubscriptionUpdate(authManager) {
    try {
        const { data: { user }, error: userError } = await authManager.supabase.auth.getUser();
        if (userError || !user) {
            alert('ユーザー認証エラー');
            return false;
        }

        // 手動更新時も有効期限を設定
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const { error } = await authManager.supabase
            .from('users')
            .upsert({ 
                id: user.id,
                email: user.email,
                is_subscribed: true,
                subscription_status: 'active',
                subscription_expires_at: expiresAt.toISOString(),
                subscription_plan: 'monthly',
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Manual update error:', error);
            alert('手動更新に失敗しました: ' + error.message);
            return false;
        }

        console.log('Manual subscription update successful');
        hideAuthOverlay();
        return true;
    } catch (error) {
        console.error('Manual update failed:', error);
        alert('予期しないエラーが発生しました');
        return false;
    }
}