// /public/assets/js/main.js

// グローバル変数
let currentLanguage = 'ja';
let currentCurrency = 'JPY';
let history = [];
let bankroll = CURRENCIES[currentCurrency].initialFunds;
let initialBankroll = CURRENCIES[currentCurrency].initialFunds;
let bankrollHistory = [{ round: 0, amount: CURRENCIES[currentCurrency].initialFunds }];
let initialBetAmount = CURRENCIES[currentCurrency].initialBet;
let betAmount = CURRENCIES[currentCurrency].initialBet;
let patternVerified = false;
let verificationCount = 0;
let consecutiveLosses = 0;
let martingaleActive = false;
let tiePending = false;
let suspendBetting = false;
let consecutiveTies = 0;
let lastNonTieRound = null;
let requiredVerifications = 4;
let activeBet = null;

// クイック入力状態
let selectedPlayerScore = null;
let selectedBankerScore = null;

// リスク管理状態
let isPaused = false;
let sessionEnded = false;
let lossLimitPercentage = 20;
let lossLimitAmount = initialBankroll * (lossLimitPercentage / 100);

// 通貨フォーマット
function formatCurrency(amount) {
    return formatCurrency(amount, currentCurrency);
}

// 翻訳取得
function t(key) {
    return getTranslation(key, currentLanguage);
}

// UI更新
function updateUIText() {
    document.getElementById('appTitle').textContent = t('title');
    document.getElementById('currentFundsLabel').textContent = t('currentFunds') + ':';
    document.getElementById('currentLang').textContent = 
        ['日本語', 'English', 'Español', '中文', '한국어', 'Français'][
            ['ja', 'en', 'es', 'zh', 'ko', 'fr'].indexOf(currentLanguage)
        ];
    
    const currency = CURRENCIES[currentCurrency];
    document.getElementById('headerCurrencyLabel').textContent = 
        getCurrencyName(currentCurrency, currentLanguage);
    
    // 各ラベル更新
    document.getElementById('quickInputTitle').textContent = t('quickInput');
    document.getElementById('playerLabel').textContent = t('playerScore');
    document.getElementById('bankerLabel').textContent = t('bankerScore');
    document.getElementById('winnerLabel').textContent = t('winner') + ':';
    document.getElementById('scoreDiffLabel').textContent = t('scoreDifference') + ':';
    document.getElementById('calculateText').textContent = t('calculate');
    document.getElementById('riskManagementTitle').textContent = t('riskManagement');
    document.getElementById('fundsRatioLabel').textContent = t('fundsRatio');
    document.getElementById('riskLevelLabel').textContent = t('riskLevel');
    document.getElementById('lossLimitLabel').textContent = t('lossLimit');
    document.getElementById('currentLossLabel').textContent = t('currentLoss');
    document.getElementById('pauseText').textContent = t('pause');
    document.getElementById('stopText').textContent = t('stop');
    document.getElementById('betSuggestionTitle').textContent = t('nextBetSuggestion');
    document.getElementById('statusTitle').textContent = '📊 ' + t('status');
    document.getElementById('strategyVerificationLabel').textContent = t('strategyVerification') + ':';
    document.getElementById('martingaleLabel').textContent = t('martingale') + ':';
    document.getElementById('consecutiveLossesLabel').textContent = t('consecutiveLosses') + ':';
    document.getElementById('currentBetLabel').textContent = t('currentBetAmount') + ':';
    document.getElementById('tieStatusLabel').textContent = t('tieStatus') + ':';
    document.getElementById('resetText').textContent = t('resetAllData');
    document.getElementById('fundsProgressTitle').textContent = '📈 ' + t('fundsProgress');
    document.getElementById('gameHistoryTitle').textContent = '📋 ' + t('gameHistory');
    document.getElementById('chartPlaceholder').textContent = t('chartPlaceholder');
    document.getElementById('rulesBtn').textContent = t('rulesButton');
    
    // 設定モーダル
    document.getElementById('currencySectionTitle').textContent = t('currencySection');
    document.getElementById('languageSectionTitle').textContent = t('languageSection');
    document.getElementById('languageLabel').textContent = t('language');
    document.getElementById('fundsSectionTitle').textContent = t('fundsSection');
    document.getElementById('initialFundsLabel').textContent = t('initialFunds');
    document.getElementById('strategySectionTitle').textContent = t('strategySection');
    document.getElementById('verificationCountLabel').textContent = t('verificationCount');
    document.getElementById('riskSectionTitle').textContent = t('riskSection');
    document.getElementById('lossLimitPercentLabel').textContent = t('lossLimitPercent');
    document.getElementById('applyText').textContent = t('apply');
    document.getElementById('cancelText').textContent = t('cancel');
    document.getElementById('noLimitText').textContent = `0% (${t('unlimited')})`;
    
    updateDisplay();
}

function updateDisplay() {
    document.getElementById('fundsAmount').textContent = formatCurrency(bankroll);
    document.getElementById('currentBetAmount').textContent = formatCurrency(betAmount);
    document.getElementById('consecutiveLossesCount').textContent = consecutiveLosses + t('times');
    document.getElementById('suggestionText').textContent = getSuggestionText();
    updateVerificationStatus();
    updateMartingaleStatus();
    updateTieStatus();
    updateRiskDisplay();
    refreshHistory();
    updateChart();
}

function getSuggestionText() {
    if (sessionEnded) return t('sessionEnded');
    if (isPaused) return t('paused');
    if (suspendBetting) return t('tieOccurred');

    if (!patternVerified) {
        if (verificationCount === 0) {
            return `${t('initialVerification')}`;
        } else {
            return `${t('patternVerifying')} (${verificationCount}/${requiredVerifications})`;
        }
    }

    const suggestedBet = getSuggestedBet();
    if (suggestedBet) {
        const betStatus = martingaleActive ? t('martingaleContinue') : t('newBet');
        return `${betStatus}: ${suggestedBet} (${formatCurrency(betAmount)})`;
    } else {
        return t('noBetSuggestion');
    }
}

function getSuggestedBet() {
    const nonTieRounds = history.filter(r => r.winner !== t('tie'));
    if (nonTieRounds.length < 1) return null;

    const lastRound = nonTieRounds[nonTieRounds.length - 1];
    const diffType = lastRound.diffType;
    const lastWinner = lastRound.winner;

    if (diffType === t('even')) {
        return lastWinner === t('player') ? t('banker') : t('player');
    } else if (diffType === t('odd')) {
        return lastWinner;
    }

    return null;
}

function updateVerificationStatus() {
    const statusElement = document.getElementById('verificationStatus');
    if (patternVerified) {
        statusElement.textContent = t('patternVerified');
        statusElement.className = 'status-badge status-verified';
    } else {
        statusElement.textContent = `${t('patternVerifying')} (${verificationCount}/${requiredVerifications})`;
        statusElement.className = 'status-badge status-verifying';
    }
}

function updateMartingaleStatus() {
    const statusElement = document.getElementById('martingaleStatus');
    if (martingaleActive) {
        statusElement.textContent = t('active');
        statusElement.className = 'status-badge status-active';
    } else {
        statusElement.textContent = t('inactive');
        statusElement.className = 'status-badge status-inactive';
    }
}

function updateTieStatus() {
    const tieItem = document.getElementById('tieStatusItem');
    const tieValue = document.getElementById('tieStatusValue');
    
    if (consecutiveTies > 0) {
        tieItem.classList.remove('hidden');
        tieValue.textContent = consecutiveTies + t('consecutiveTie');
    } else {
        tieItem.classList.add('hidden');
    }
}

function updateRiskDisplay() {
    const currentLoss = initialBankroll - bankroll;
    const lossPercentage = (currentLoss / initialBankroll * 100);
    const fundsRatio = (bankroll / initialBankroll * 100);
    
    document.getElementById('fundsRatio').textContent = fundsRatio.toFixed(1) + '%';
    document.getElementById('currentLoss').textContent = currentLoss >= 0 ? 
        formatCurrency(currentLoss) : 
        '+' + formatCurrency(Math.abs(currentLoss));
    document.getElementById('currentLoss').style.color = currentLoss >= 0 ? '#ef4444' : '#10b981';
    
    const lossLimitFormatted = formatCurrency(lossLimitAmount);
    document.getElementById('lossLimitDisplay').textContent = 
        `${lossLimitFormatted} (${lossLimitPercentage}%)`;
    
    const riskLevelElement = document.getElementById('riskLevel');
    if (lossLimitPercentage > 0 && lossPercentage >= lossLimitPercentage) {
        riskLevelElement.textContent = t('high');
        riskLevelElement.className = 'risk-level risk-high';
        if (!sessionEnded) {
            endSession();
        }
    } else if (lossPercentage >= lossLimitPercentage * 0.75) {
        riskLevelElement.textContent = t('high');
        riskLevelElement.className = 'risk-level risk-high';
    } else if (lossPercentage >= lossLimitPercentage * 0.5) {
        riskLevelElement.textContent = t('medium');
        riskLevelElement.className = 'risk-level risk-medium';
    } else {
        riskLevelElement.textContent = t('safe');
        riskLevelElement.className = 'risk-level risk-safe';
    }
}

function refreshHistory() {
    const container = document.getElementById("historyContainer");
    container.innerHTML = "";

    if (history.length === 0) {
        container.innerHTML = `<div class="history-empty">${t('noHistoryYet')}</div>`;
        return;
    }

    history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerHTML = `
            <span>${item.round} : ${item.winner}</span>
            <span>${formatCurrency(item.funds)}</span>
        `;
        container.prepend(div);
    });
}

function updateChart() {
    const canvas = document.getElementById('fundsChart');
    const placeholder = document.getElementById('chartPlaceholder');
    
    if (bankrollHistory.length <= 1) {
        placeholder.style.display = 'block';
        canvas.style.display = 'none';
        return;
    }
    
    placeholder.style.display = 'none';
    canvas.style.display = 'block';
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const padding = 60;
    const chartWidth = rect.width - 2 * padding;
    const chartHeight = rect.height - 2 * padding;
    
    const amounts = bankrollHistory.map(h => h.amount);
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const amountRange = Math.max(maxAmount - minAmount, maxAmount * 0.1);
    
    const adjustedMin = minAmount - amountRange * 0.1;
    const adjustedMax = maxAmount + amountRange * 0.1;
    const adjustedRange = adjustedMax - adjustedMin;
    
    ctx.fillStyle = 'rgba(55, 65, 81, 0.8)';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // グリッドとデータプロット（簡略化）
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    
    // チャート描画ロジック（省略 - 既存コードと同じ）
    // ...
}

function setupScoreButtons() {
    document.querySelectorAll('[data-player]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-player]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedPlayerScore = parseInt(btn.dataset.player);
            checkAutoCalculate();
        });
    });
    
    document.querySelectorAll('[data-banker]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-banker]').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedBankerScore = parseInt(btn.dataset.banker);
            checkAutoCalculate();
        });
    });
}

function checkAutoCalculate() {
    if (selectedPlayerScore !== null && selectedBankerScore !== null && 
        !sessionEnded && !isPaused) {
        setTimeout(() => {
            calculateResult();
            selectedPlayerScore = null;
            selectedBankerScore = null;
            document.querySelectorAll('.score-btn.selected').forEach(btn => {
                btn.classList.remove('selected');
            });
        }, 100);
    }
}

function calculateResult() {
    if (sessionEnded || isPaused) return;
    
    const playerScore = selectedPlayerScore;
    const bankerScore = selectedBankerScore;
    
    if (playerScore === null || bankerScore === null) return;
    
    let resultWinner;
    if (playerScore > bankerScore) {
        resultWinner = t('player');
    } else if (bankerScore > playerScore) {
        resultWinner = t('banker');
    } else {
        resultWinner = t('tie');
    }

    const diff = Math.abs(playerScore - bankerScore);
    const diffType = diff % 2 === 0 ? t('even') : t('odd');
    
    if (activeBet && resultWinner !== t('tie')) {
        const betResult = (activeBet === resultWinner) ? 'win' : 'lose';
        applyBetResultAuto(betResult);
        activeBet = null;
    }
    
    document.getElementById('winnerValue').textContent = resultWinner;
    document.getElementById('winnerValue').className = getWinnerClass(resultWinner);
    document.getElementById('scoreDiffValue').textContent = `${diff}`;
    document.getElementById('resultDisplay').classList.remove('hidden');

    const roundResult = {
        playerScore,
        bankerScore,
        winner: resultWinner,
        diffType,
        round: history.length + 1,
        funds: bankroll
    };

    processResult(roundResult);
}

function getWinnerClass(winner) {
    if (winner === t('player')) return 'winner-player';
    if (winner === t('banker')) return 'winner-banker';
    return 'winner-tie';
}

function processResult(roundResult) {
    if (roundResult.winner === t('tie')) {
        handleTie(roundResult);
    } else {
        handleNonTie(roundResult);
    }
}

function handleTie(roundResult) {
    if (!tiePending) {
        tiePending = true;
        suspendBetting = true;
        consecutiveTies = 1;
        
        const nonTieHistory = history.filter(r => r.winner !== t('tie'));
        if (nonTieHistory.length > 0) {
            lastNonTieRound = nonTieHistory[nonTieHistory.length - 1];
        }
    } else {
        consecutiveTies += 1;
    }

    history.push(roundResult);
    updateDisplay();
}

function handleNonTie(roundResult) {
    if (tiePending) {
        tiePending = false;
        consecutiveTies = 0;
    }
    
    history.push(roundResult);
    
    if (!patternVerified) {
        const verification = verifyPattern(history);
        
        if (verification.isVerified) {
            verificationCount += 1;
            
            if (verificationCount >= requiredVerifications) {
                patternVerified = true;
            }
        } else {
            verificationCount = 0;
        }
    }
    
    if (patternVerified && !suspendBetting && !sessionEnded && !isPaused) {
        const suggestion = getSuggestedBet();
        if (suggestion) {
            activeBet = suggestion;
        }
    }
    
    suspendBetting = false;
    updateDisplay();
}

function verifyPattern(currentHistory) {
    if (currentHistory.length < 2) {
        return { isVerified: false };
    }

    const nonTieRounds = currentHistory.filter(r => r.winner !== t('tie'));
    if (nonTieRounds.length < 2) {
        return { isVerified: false };
    }

    const prevRound = nonTieRounds[nonTieRounds.length - 2];
    const currRound = nonTieRounds[nonTieRounds.length - 1];
    
    const prevWinner = prevRound.winner;
    const currWinner = currRound.winner;
    const diffType = prevRound.diffType;

    if (diffType === t('even')) {
        return { isVerified: prevWinner !== currWinner };
    } else if (diffType === t('odd')) {
        return { isVerified: prevWinner === currWinner };
    }

    return { isVerified: false };
}

function applyBetResultAuto(result) {
    if (result === 'win') {
        bankroll += betAmount;
        betAmount = initialBetAmount;
        consecutiveLosses = 0;
        martingaleActive = false;
        patternVerified = false;
        verificationCount = 0;
    } else if (result === 'lose') {
        bankroll -= betAmount;
        consecutiveLosses += 1;
        betAmount *= 2;
        martingaleActive = true;
    }

    bankrollHistory.push({ 
        round: bankrollHistory.length, 
        amount: bankroll 
    });
    
    checkRiskManagement();
}

function checkRiskManagement() {
    const currentLoss = initialBankroll - bankroll;
    const lossPercentage = (currentLoss / initialBankroll * 100);
    
    if (lossPercentage >= lossLimitPercentage && !sessionEnded && lossLimitPercentage > 0) {
        endSession();
    }
}

function pauseSession() {
    isPaused = true;
    document.getElementById('pauseOverlay').classList.remove('hidden');
    updateDisplay();
}

function resumeSession() {
    isPaused = false;
    document.getElementById('pauseOverlay').classList.add('hidden');
    updateDisplay();
}

function endSession() {
    sessionEnded = true;
    suspendBetting = true;
    activeBet = null;
    
    const overlay = document.getElementById('pauseOverlay');
    const content = overlay.querySelector('.pause-content');
    content.innerHTML = `
        <h2>🛑 ${t('sessionEnded')}</h2>
        <p>${t('sessionEndedDescription')}</p>
        <button class="resume-btn" onclick="resetAll()">🔄 ${t('resetAllData')}</button>
    `;
    overlay.classList.remove('hidden');
    updateDisplay();
}

function resetAll() {
    if (!sessionEnded && !confirm(t('confirmReset'))) return;
    
    history = [];
    bankroll = initialBankroll;
    bankrollHistory = [{ round: 0, amount: initialBankroll }];
    betAmount = initialBetAmount;
    patternVerified = false;
    verificationCount = 0;
    consecutiveLosses = 0;
    martingaleActive = false;
    tiePending = false;
    suspendBetting = false;
    consecutiveTies = 0;
    lastNonTieRound = null;
    activeBet = null;
    selectedPlayerScore = null;
    selectedBankerScore = null;
    isPaused = false;
    sessionEnded = false;
    
    lossLimitAmount = initialBankroll * (lossLimitPercentage / 100);
    
    document.querySelectorAll('.score-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById('resultDisplay').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    
    updateDisplay();
}

function setCurrency(currencyCode) {
    currentCurrency = currencyCode;
    const currency = CURRENCIES[currencyCode];
    
    initialBankroll = currency.initialFunds;
    initialBetAmount = currency.initialBet;
    
    resetAll();
    
    document.getElementById('initialFundsInput').value = initialBankroll;
    updateDisplay();
}

// イベントリスナー設定
function setupEventListeners() {
    document.getElementById('calculateBtn').addEventListener('click', calculateResult);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('pauseBtn').addEventListener('click', pauseSession);
    document.getElementById('stopBtn').addEventListener('click', endSession);
    document.getElementById('resumeBtn').addEventListener('click', resumeSession);
    document.getElementById('rulesBtn').addEventListener('click', () => {
        window.location.href = 'rules.html';
    });
    
    // 設定モーダル
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('currencySelect').value = currentCurrency;
        document.getElementById('languageSelect').value = currentLanguage;
        document.getElementById('initialFundsInput').value = initialBankroll;
        document.getElementById('verificationCountInput').value = requiredVerifications;
        document.getElementById('lossLimitSlider').value = lossLimitPercentage;
        updateLossLimitDisplay();
        document.getElementById('settingsModal').classList.remove('hidden');
    });
    
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('settingsModal')) {
            document.getElementById('settingsModal').classList.add('hidden');
        }
    });
    
    document.getElementById('applySettings').addEventListener('click', applySettings);
    document.getElementById('cancelSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
    });
    
    document.getElementById('lossLimitSlider').addEventListener('input', (e) => {
        const percentage = parseInt(e.target.value);
        lossLimitPercentage = percentage;
        lossLimitAmount = initialBankroll * (percentage / 100);
        updateLossLimitDisplay();
        updateRiskDisplay();
    });
    
    window.addEventListener('resize', debounce(updateChart, 100));
}

function applySettings() {
    const newCurrency = document.getElementById('currencySelect').value;
    const newLanguage = document.getElementById('languageSelect').value;
    const newInitialBankroll = parseInt(document.getElementById('initialFundsInput').value);
    const newRequiredVerifications = parseInt(document.getElementById('verificationCountInput').value);
    const newLossLimitPercentage = parseInt(document.getElementById('lossLimitSlider').value);
    
    if (newCurrency !== currentCurrency) {
        setCurrency(newCurrency);
    }
    
    if (newLanguage !== currentLanguage) {
        currentLanguage = newLanguage;
    }
    
    if (newInitialBankroll !== initialBankroll) {
        initialBankroll = newInitialBankroll;
        bankroll = initialBankroll;
        bankrollHistory = [{ round: 0, amount: initialBankroll }];
    }
    
    requiredVerifications = newRequiredVerifications;
    lossLimitPercentage = newLossLimitPercentage;
    lossLimitAmount = initialBankroll * (lossLimitPercentage / 100);
    
    document.getElementById('settingsModal').classList.add('hidden');
    updateUIText();
    updateDisplay();
}

function updateLossLimitDisplay() {
    const percentage = document.getElementById('lossLimitSlider').value;
    const amount = initialBankroll * (percentage / 100);
    const formattedAmount = formatCurrency(amount);
    
    document.getElementById('currentLossLimitPercent').textContent = percentage + '%';
    document.getElementById('currentLimitDisplay').textContent = 
        `${t('lossLimit')} ${formattedAmount} (${percentage}%)`;
    document.getElementById('sliderValuePopup').textContent = percentage + '%';
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    setupScoreButtons();
    setupEventListeners();
    updateUIText();
    updateDisplay();
});