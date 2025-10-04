// /public/assets/js/auth.js

class AuthManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentUser = null;
        this.isAuthenticated = false;
        this.checkingSubscription = false;
    }

    async initialize() {
        try {
            await this.handlePostPayment();
            
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Session check error:', error);
                this.updateAuthState(null);
                return;
            }
            
            if (session?.user) {
                await this.updateAuthState(session.user);
            } else {
                this.updateAuthState(null);
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.updateAuthState(null);
        }

        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session?.user?.email);
            
            switch (event) {
                case 'SIGNED_IN':
                    this.updateAuthState(session?.user);
                    break;
                case 'SIGNED_OUT':
                    this.updateAuthState(null);
                    break;
            }
        });
    }

    async handlePostPayment() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const success = urlParams.get('success');
        const cancelled = urlParams.get('cancelled');

        if (success === 'true' || sessionId) {
            console.log('Payment successful, verifying subscription...');
            
            showAuthOverlay();
            showVerificationSection();
            
            window.history.replaceState({}, document.title, window.location.pathname);
            
            await this.verifySubscriptionWithRetry();
            
        } else if (cancelled === 'true') {
            console.log('Payment cancelled');
            showAuthOverlay();
            showSubscriptionSection();
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async verifySubscriptionWithRetry(maxAttempts = 8) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Subscription check attempt ${attempt}/${maxAttempts}`);
            
            const { isSubscribed } = await checkUserSubscription(
                this.supabase, 
                this.currentUser?.id
            );
            
            if (isSubscribed) {
                console.log('Subscription confirmed successfully');
                hideAuthOverlay();
                return true;
            }
            
            if (attempt < maxAttempts) {
                const waitTime = attempt * 2000;
                console.log(`Waiting ${waitTime}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                console.log('Auto-verification failed, showing manual refresh option');
                document.getElementById('manualRefreshBtn').style.display = 'block';
                document.getElementById('verificationDescription').textContent = 
                    'サブスクリプション確認に時間がかかっています。手動で確認してください。';
            }
        }
        return false;
    }

    async signInWithGoogle() {
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) {
                console.error('Login error:', error);
                alert('ログインエラー: ' + error.message);
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('予期しないエラーが発生しました: ' + error.message);
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) {
                console.error('Logout error:', error);
                alert('ログアウトエラー: ' + error.message);
            }
        } catch (error) {
            console.error('Logout failed:', error);
            alert('予期しないエラーが発生しました: ' + error.message);
        }
    }

    async updateAuthState(user) {
        this.currentUser = user;
        this.isAuthenticated = !!user;
        
        const headerLoginBtn = document.getElementById('google-login');
        if (headerLoginBtn) {
            headerLoginBtn.textContent = this.isAuthenticated ? 'Logout' : 'Google Login';
        }
        
        const checkoutButton = document.getElementById('checkout-button');
        if (checkoutButton) {
            if (this.isAuthenticated) {
                // 有効期限チェック付きのサブスクリプション確認
                const { isSubscribed, isExpired, expiresAt } = await checkUserSubscription(
                    this.supabase, 
                    user.id
                );

                if (isExpired) {
                    console.log('⚠️ Subscription expired, showing renewal option');
                    checkoutButton.textContent = 'サブスクを更新する';
                    checkoutButton.style.display = 'block';
                } else if (isSubscribed) {
                    checkoutButton.style.display = 'none';
                    // 有効期限を表示
                    this.displayExpiryInfo(expiresAt);
                } else {
                    checkoutButton.textContent = 'サブスクに登録する';
                    checkoutButton.style.display = 'block';
                }
            } else {
                checkoutButton.style.display = 'none';
            }
        }
        
        if (this.isAuthenticated) {
            const { isSubscribed, isExpired } = await checkUserSubscription(
                this.supabase, 
                user.id
            );

            if (isSubscribed) {
                hideAuthOverlay();
            } else {
                showAuthOverlay();
                if (isExpired) {
                    showSubscriptionSection('期限切れです。更新してください。');
                } else {
                    showSubscriptionSection();
                }
            }
        } else {
            showAuthOverlay();
            showLoginSection();
        }
    }

    displayExpiryInfo(expiresAt) {
        if (!expiresAt) return;

        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

        let expiryInfo = document.getElementById('subscription-expiry-info');
        if (!expiryInfo) {
            expiryInfo = document.createElement('div');
            expiryInfo.id = 'subscription-expiry-info';
            expiryInfo.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(16, 185, 129, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 12px;
                font-size: 14px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                z-index: 1000;
            `;
            document.body.appendChild(expiryInfo);
        }

        if (daysLeft <= 7) {
            expiryInfo.style.background = 'rgba(245, 158, 11, 0.9)';
            expiryInfo.innerHTML = `⚠️ サブスクは ${daysLeft} 日後に期限切れです`;
        } else {
            expiryInfo.innerHTML = `✅ サブスク有効 (残り ${daysLeft} 日)`;
        }

        setTimeout(() => {
            if (expiryInfo) {
                expiryInfo.style.opacity = '0';
                expiryInfo.style.transition = 'opacity 0.5s';
                setTimeout(() => expiryInfo.remove(), 500);
            }
        }, 3000);
    }

    handleAuthStateChange(event, session) {
        if (event === 'SIGNED_IN') {
            this.updateAuthState(session?.user);
        } else if (event === 'SIGNED_OUT') {
            this.updateAuthState(null);
        }
    }
}

// UI制御関数
function showAuthOverlay() {
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('appContent').classList.add('hidden');
}

function hideAuthOverlay() {
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('appContent').classList.remove('hidden');
}

function showLoginSection() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('subscriptionSection').classList.add('hidden');
    document.getElementById('verificationSection').classList.add('hidden');
}

function showSubscriptionSection(message = null) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('subscriptionSection').classList.remove('hidden');
    document.getElementById('verificationSection').classList.add('hidden');
    
    // カスタムメッセージがあれば表示
    if (message) {
        const descElement = document.getElementById('subscriptionDescription');
        if (descElement) {
            descElement.textContent = message;
        }
    }
}

function showVerificationSection() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('subscriptionSection').classList.add('hidden');
    document.getElementById('verificationSection').classList.remove('hidden');
    document.getElementById('manualRefreshBtn').style.display = 'none';
    document.getElementById('verificationDescription').textContent = 
        'お支払いの確認中です。数秒お待ちください...';
}

async function backToGoogleLogin(authManager) {
    try {
        const { error } = await authManager.supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error);
        }
        showLoginSection();
    } catch (error) {
        console.error('Back to login failed:', error);
        showLoginSection();
    }
}