// /public/assets/js/main.js - Part 1/3

// ========================================
// グローバル変数
// ========================================

let currentLanguage = 'ja';
let currentCurrency = 'JPY';
let history = [];
let bankroll = CURRENCIES[currentCurrency].initialFunds;
let initialBankroll = CURRENCIES[currentCurrency].initialFunds;
let bankrollHistory = [{ round: 0, amount: CURRENCIES[currentCurrency].initialFunds }];

// マーチンゲール設定
let maxMartingaleLevels = 8;
let initialBetAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
let betAmount = initialBetAmount;

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

// 統計情報
let statistics = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    martingaleLevelSum: 0,
    maxMartingaleReachedCount: 0,
    gameResults: []
};

// カスタマイズ設定
let betAmountMode = 'auto';
let manualBetAmount = null;

// テーマ設定
let currentTheme = localStorage.getItem('theme') || 'dark';

// ========================================
// 通貨フォーマット
// ========================================

function formatCurrency(amount, currency) {
    const currencyCode = currency || currentCurrency;
    const currencyConfig = CURRENCIES[currencyCode];
    
    if (!currencyConfig) {
        return amount.toLocaleString();
    }
    
    if (currencyConfig.isCrypto) {
        return `${currencyConfig.symbol}${amount.toFixed(currencyConfig.decimals)}`;
    }
    
    try {
        return new Intl.NumberFormat('ja-JP', {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (error) {
        return `${currencyConfig.symbol}${amount.toLocaleString()}`;
    }
}

// ========================================
// 翻訳取得
// ========================================

function t(key) {
    return getTranslation(key, currentLanguage);
}

// ========================================
// UI更新
// ========================================

function updateUIText() {
    document.getElementById('appTitle').textContent = t('title');
    document.getElementById('currentFundsLabel').textContent = t('currentFunds') + ':';
    document.getElementById('currentLang').textContent = 
        ['日本語', 'English', 'Español', '中文', '한국어', 'Français'][
            ['ja', 'en', 'es', 'zh', 'ko', 'fr'].indexOf(currentLanguage)
        ];
    
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
    document.getElementById('martingaleInfoText').textContent = t('martingaleInfo');
    document.getElementById('resetText').textContent = t('resetAllData');
    document.getElementById('fundsProgressTitle').textContent = '📈 ' + t('fundsProgress');
    document.getElementById('gameHistoryTitle').textContent = '📋 ' + t('gameHistory');
    document.getElementById('chartPlaceholder').textContent = t('chartPlaceholder');
    document.getElementById('rulesBtn').textContent = t('rulesButton');
    
    // 統計セクション
    document.getElementById('statisticsTitle').textContent = t('statistics');
    document.getElementById('winRateLabel').textContent = t('winRate');
    document.getElementById('totalGamesLabel').textContent = t('totalGames');
    document.getElementById('winsLabel').textContent = t('wins');
    document.getElementById('lossesLabel').textContent = t('losses');
    document.getElementById('tiesLabel').textContent = t('ties');
    document.getElementById('avgMartingaleLabel').textContent = t('avgMartingaleLevel') + ':';
    document.getElementById('maxMartingaleReachedLabel').textContent = t('maxMartingaleReachedCount') + ':';
    document.getElementById('maxMartingaleReachedUnit').textContent = t('times');
    document.getElementById('sessionProfitLabel').textContent = t('sessionProfit');
    
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
    
    // テーマセクション
    document.getElementById('themeSectionTitle').textContent = t('themeSection');
    document.getElementById('darkModeText').textContent = t('darkMode');
    document.getElementById('lightModeText').textContent = t('lightMode');
    
    // 高度な設定
    document.getElementById('maxMartingaleLevelLabel').textContent = t('maxMartingaleLevelSetting');
    document.getElementById('betAmountModeLabel').textContent = t('betAmountMode');
    document.getElementById('autoCalculateText').textContent = t('autoCalculate');
    document.getElementById('manualSetText').textContent = t('manualSet');
    document.getElementById('customBetAmountLabel').textContent = t('customBetAmount');
    
    updateDisplay();
}

function updateDisplay() {
    document.getElementById('fundsAmount').textContent = formatCurrency(bankroll);
    document.getElementById('currentBetAmount').textContent = formatCurrency(betAmount);
    
    const martingaleLevelText = consecutiveLosses > 0 ? 
        ` (${consecutiveLosses}${t('martingaleStage')})` : '';
    document.getElementById('consecutiveLossesCount').textContent = 
        consecutiveLosses + t('times') + martingaleLevelText;
    
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
        const martingaleLevel = consecutiveLosses > 0 ? 
            ` [${consecutiveLosses + 1}${t('martingaleStage')}]` : '';
        
        return `${betStatus}: ${suggestedBet} ${martingaleLevel}\n${formatCurrency(betAmount)}`;
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
// /public/assets/js/main.js - Part 2/3

// ========================================
// 統計機能
// ========================================

function calculateStatistics() {
    const nonTieGames = history.filter(r => r.winner !== t('tie'));
    const tieGames = history.filter(r => r.winner === t('tie'));
    
    statistics.totalGames = history.length;
    statistics.ties = tieGames.length;
    
    return statistics;
}

function getWinRate() {
    if (statistics.wins + statistics.losses === 0) return 0;
    return (statistics.wins / (statistics.wins + statistics.losses) * 100).toFixed(1);
}

function getAverageMartingaleLevel() {
    if (statistics.totalGames === 0) return 0;
    return (statistics.martingaleLevelSum / Math.max(statistics.wins + statistics.losses, 1)).toFixed(2);
}

function getSessionProfit() {
    return bankroll - initialBankroll;
}

function updateStatisticsDisplay() {
    const winRate = getWinRate();
    const avgMartingale = getAverageMartingaleLevel();
    const sessionProfit = getSessionProfit();
    
    document.getElementById('winRateValue').textContent = winRate + '%';
    document.getElementById('totalGamesValue').textContent = statistics.totalGames;
    document.getElementById('winsValue').textContent = statistics.wins;
    document.getElementById('lossesValue').textContent = statistics.losses;
    document.getElementById('tiesValue').textContent = statistics.ties;
    document.getElementById('avgMartingaleValue').textContent = avgMartingale;
    document.getElementById('maxMartingaleReachedValue').textContent = statistics.maxMartingaleReachedCount;
    
    const profitElement = document.getElementById('sessionProfitValue');
    profitElement.textContent = formatCurrency(sessionProfit);
    profitElement.style.color = sessionProfit >= 0 ? '#10b981' : '#ef4444';
    profitElement.className = sessionProfit >= 0 ? 'profit-positive' : 'profit-negative';
}

// ========================================
// 履歴・チャート更新
// ========================================

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
    
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + chartWidth, y);
        ctx.stroke();
        
        const value = adjustedMax - (adjustedRange / gridLines) * i;
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(formatChartLabel(Math.round(value), currentCurrency), padding - 10, y + 4);
    }
    
    const initialY = padding + chartHeight - ((initialBankroll - adjustedMin) / adjustedRange) * chartHeight;
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, initialY);
    ctx.lineTo(padding + chartWidth, initialY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    bankrollHistory.forEach((point, index) => {
        const x = padding + (chartWidth / (bankrollHistory.length - 1)) * index;
        const y = padding + chartHeight - ((point.amount - adjustedMin) / adjustedRange) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    bankrollHistory.forEach((point, index) => {
        const x = padding + (chartWidth / (bankrollHistory.length - 1)) * index;
        const y = padding + chartHeight - ((point.amount - adjustedMin) / adjustedRange) * chartHeight;
        
        ctx.fillStyle = point.amount >= initialBankroll ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    const labelInterval = Math.max(1, Math.floor(bankrollHistory.length / 10));
    bankrollHistory.forEach((point, index) => {
        if (index % labelInterval === 0 || index === bankrollHistory.length - 1) {
            const x = padding + (chartWidth / (bankrollHistory.length - 1)) * index;
            ctx.fillText(`R${point.round}`, x, rect.height - padding + 20);
        }
    });
}

// ========================================
// スコアボタン設定
// ========================================

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

// ========================================
// 結果計算とパターン検証
// ========================================

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

// ========================================
// ベット結果適用（統計記録付き）
// ========================================

function applyBetResultAuto(result) {
    statistics.martingaleLevelSum += consecutiveLosses;
    
    if (result === 'win') {
        statistics.wins += 1;
        statistics.gameResults.push({ result: 'win', level: consecutiveLosses, amount: betAmount });
        
        bankroll += betAmount;
        betAmount = betAmountMode === 'auto' ? initialBetAmount : manualBetAmount;
        consecutiveLosses = 0;
        martingaleActive = false;
        
    } else if (result === 'lose') {
        statistics.losses += 1;
        statistics.gameResults.push({ result: 'lose', level: consecutiveLosses, amount: betAmount });
        
        bankroll -= betAmount;
        consecutiveLosses += 1;
        
        if (consecutiveLosses >= maxMartingaleLevels) {
            statistics.maxMartingaleReachedCount += 1;
            
            betAmount = betAmountMode === 'auto' ? initialBetAmount : manualBetAmount;
            consecutiveLosses = 0;
            martingaleActive = false;
            
            alert(`${maxMartingaleLevels}${t('martingaleStage')}${t('maxMartingaleReached')}`);
        } else {
            betAmount *= 2;
            martingaleActive = true;
        }
    }

    bankrollHistory.push({ 
        round: bankrollHistory.length, 
        amount: bankroll 
    });
    
    updateStatisticsDisplay();
    checkRiskManagement();
}

function checkRiskManagement() {
    const currentLoss = initialBankroll - bankroll;
    const lossPercentage = (currentLoss / initialBankroll * 100);
    
    if (lossPercentage >= lossLimitPercentage && !sessionEnded && lossLimitPercentage > 0) {
        endSession();
    }
}

// /public/assets/js/main.js - Part 3/3

// ========================================
// セッション管理
// ========================================

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
    
    initialBetAmount = betAmountMode === 'auto' 
        ? calculateMartingaleBet(initialBankroll, maxMartingaleLevels)
        : manualBetAmount;
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
    
    statistics = {
        totalGames: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        martingaleLevelSum: 0,
        maxMartingaleReachedCount: 0,
        gameResults: []
    };
    
    lossLimitAmount = initialBankroll * (lossLimitPercentage / 100);
    
    document.querySelectorAll('.score-btn.selected').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.getElementById('resultDisplay').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    
    updateDisplay();
    updateStatisticsDisplay();
}

function setCurrency(currencyCode) {
    currentCurrency = currencyCode;
    const currency = CURRENCIES[currencyCode];
    
    initialBankroll = currency.initialFunds;
    
    if (betAmountMode === 'auto') {
        initialBetAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
    }
    
    resetAll();
    
    document.getElementById('initialFundsInput').value = initialBankroll;
    updateDisplay();
}

// ========================================
// カスタマイズ機能
// ========================================

function toggleBetAmountMode() {
    const mode = document.querySelector('input[name="betAmountMode"]:checked').value;
    betAmountMode = mode;
    
    const manualInput = document.getElementById('manualBetAmountInput');
    const manualGroup = document.getElementById('manualBetAmountGroup');
    
    if (mode === 'manual') {
        manualGroup.classList.remove('hidden');
        manualBetAmount = parseInt(manualInput.value) || initialBetAmount;
        betAmount = manualBetAmount;
    } else {
        manualGroup.classList.add('hidden');
        betAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
        initialBetAmount = betAmount;
    }
    
    updateDisplay();
}

function updateMaxMartingaleLevel() {
    const newLevel = parseInt(document.getElementById('maxMartingaleLevelInput').value);
    if (newLevel >= 1 && newLevel <= 10) {
        maxMartingaleLevels = newLevel;
        
        if (betAmountMode === 'auto') {
            initialBetAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
            betAmount = initialBetAmount;
        }
        
        document.getElementById('martingaleInfoText').textContent = 
            t('martingaleInfo').replace('8', maxMartingaleLevels);
        
        updateDisplay();
    }
}

// ========================================
// テーマ切り替え
// ========================================

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`theme-${theme}`).classList.add('active');
}

function initTheme() {
    setTheme(currentTheme);
}

// ========================================
// イベントリスナー設定
// ========================================

function setupEventListeners() {
    document.getElementById('calculateBtn').addEventListener('click', calculateResult);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
    document.getElementById('pauseBtn').addEventListener('click', pauseSession);
    document.getElementById('stopBtn').addEventListener('click', endSession);
    document.getElementById('resumeBtn').addEventListener('click', resumeSession);
    document.getElementById('rulesBtn').addEventListener('click', () => {
        window.location.href = 'rules.html';
    });
    
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('currencySelect').value = currentCurrency;
        document.getElementById('languageSelect').value = currentLanguage;
        document.getElementById('initialFundsInput').value = initialBankroll;
        document.getElementById('verificationCountInput').value = requiredVerifications;
        document.getElementById('lossLimitSlider').value = lossLimitPercentage;
        document.getElementById('maxMartingaleLevelInput').value = maxMartingaleLevels;
        
        document.querySelector(`input[name="betAmountMode"][value="${betAmountMode}"]`).checked = true;
        if (betAmountMode === 'manual') {
            document.getElementById('manualBetAmountGroup').classList.remove('hidden');
            document.getElementById('manualBetAmountInput').value = manualBetAmount || initialBetAmount;
        } else {
            document.getElementById('manualBetAmountGroup').classList.add('hidden');
        }
        
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
    const newMaxMartingaleLevel = parseInt(document.getElementById('maxMartingaleLevelInput').value);
    
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
        
        if (betAmountMode === 'auto') {
            initialBetAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
            betAmount = initialBetAmount;
        }
    }
    
    if (newMaxMartingaleLevel !== maxMartingaleLevels) {
        maxMartingaleLevels = newMaxMartingaleLevel;
        if (betAmountMode === 'auto') {
            initialBetAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
            betAmount = initialBetAmount;
        }
    }
    
    const newBetAmountMode = document.querySelector('input[name="betAmountMode"]:checked').value;
    if (newBetAmountMode === 'manual') {
        betAmountMode = 'manual';
        manualBetAmount = parseInt(document.getElementById('manualBetAmountInput').value);
        betAmount = manualBetAmount;
    } else {
        betAmountMode = 'auto';
        initialBetAmount = calculateMartingaleBet(initialBankroll, maxMartingaleLevels);
        betAmount = initialBetAmount;
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

// ========================================
// 初期化
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupScoreButtons();
    setupEventListeners();
    updateUIText();
    updateDisplay();
    updateStatisticsDisplay();
});

// main.js の末尾に追加 - モバイル用タブ切り替え

// ========================================
// モバイル用タブ機能（768px以下で有効化）
// ========================================

function initMobileTabs() {
    if (window.innerWidth <= 768) {
        createMobileTabs();
    }
}

function createMobileTabs() {
    // タブナビゲーションを作成（多言語対応）
    const tabNavHTML = `
        <div class="mobile-tab-nav" id="mobileTabNav">
            <button class="mobile-tab-btn active" data-tab="game" onclick="switchMobileTab('game')">
                <span>🎮</span>
                <span id="mobileTabGame">${t('mobileTabGame')}</span>
            </button>
            <button class="mobile-tab-btn" data-tab="stats" onclick="switchMobileTab('stats')">
                <span>📊</span>
                <span id="mobileTabStats">${t('mobileTabStats')}</span>
            </button>
            <button class="mobile-tab-btn" data-tab="chart" onclick="switchMobileTab('chart')">
                <span>📈</span>
                <span id="mobileTabChart">${t('mobileTabChart')}</span>
            </button>
        </div>
    `;
    
    // タブナビゲーションを挿入
    const container = document.querySelector('.container');
    if (container && !document.getElementById('mobileTabNav')) {
        container.insertAdjacentHTML('afterbegin', tabNavHTML);
    }
    
    // 各セクションにタブクラスを追加
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const leftPanel = mainContent.children[0];
        const rightPanel = mainContent.children[1];
        
        if (leftPanel) {
            // ゲームタブ: クイック入力、リスク管理、ベット提案
            const gameCards = [
                leftPanel.querySelector('.card:nth-child(1)'), // クイック入力
                leftPanel.querySelector('.risk-card'),
                leftPanel.querySelector('.card:nth-child(3)')  // ベット提案
            ];
            gameCards.forEach(card => {
                if (card) card.setAttribute('data-mobile-tab', 'game');
            });
            
            // 統計タブ: ステータス、統計カード
            const statsCards = [
                leftPanel.querySelector('.card:nth-child(4)'), // ステータス
                leftPanel.querySelector('.statistics-card')
            ];
            statsCards.forEach(card => {
                if (card) card.setAttribute('data-mobile-tab', 'stats');
            });
        }
        
        if (rightPanel) {
            // チャートタブ: チャートと履歴
            Array.from(rightPanel.children).forEach(card => {
                card.setAttribute('data-mobile-tab', 'chart');
            });
        }
    }
    
    // 初期表示設定
    switchMobileTab('game');
}

function switchMobileTab(tabName) {
    // タブボタンのアクティブ状態更新
    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // カードの表示切り替え
    document.querySelectorAll('[data-mobile-tab]').forEach(card => {
        if (card.getAttribute('data-mobile-tab') === tabName) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
    
    // リセットボタンは常に表示
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn && tabName === 'stats') {
        resetBtn.style.display = 'block';
    } else if (resetBtn && tabName !== 'game') {
        resetBtn.style.display = 'none';
    }
}

// ウィンドウリサイズ時の処理
function handleResize() {
    if (window.innerWidth <= 768) {
        if (!document.getElementById('mobileTabNav')) {
            createMobileTabs();
        }
    } else {
        // デスクトップ表示に戻す
        const tabNav = document.getElementById('mobileTabNav');
        if (tabNav) {
            tabNav.remove();
        }
        document.querySelectorAll('[data-mobile-tab]').forEach(card => {
            card.style.display = 'block';
        });
    }
}

// 初期化時とリサイズ時にタブを設定
window.addEventListener('resize', debounce(handleResize, 200));
document.addEventListener('DOMContentLoaded', () => {
    // 既存の初期化の後に追加
    setTimeout(initMobileTabs, 100);
});