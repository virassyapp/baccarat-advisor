// /public/assets/js/utils/helpers.js

const CURRENCIES = {
    JPY: {
        symbol: "¥",
        initialFunds: 100000,
        step: 100,
        format: (value) => `¥${value.toLocaleString("ja-JP")}`
    },
    USD: {
        symbol: "$",
        initialFunds: 1000,
        step: 1,
        format: (value) => `$${value.toLocaleString("en-US")}`
    },
    EUR: {
        symbol: "€",
        initialFunds: 900,
        step: 1,
        format: (value) => `€${value.toLocaleString("de-DE")}`
    },
    KRW: {
        symbol: "₩",
        initialFunds: 1200000,
        step: 1000,
        format: (value) => `₩${value.toLocaleString("ko-KR")}`
    },
    CNY: {
        symbol: "¥",
        initialFunds: 7000,
        step: 1,
        format: (value) => `¥${value.toLocaleString("zh-CN")}`
    }
};

/**
 * 8マーチンゲール用のベット額計算関数
 * @param {number} initialFunds - 初期資金
 * @param {number} maxMartingaleLevels - 最大マーチンレベル（デフォルト8）
 * @returns {number} 計算された初期ベット額
 */
function calculateMartingaleBet(initialFunds, maxMartingaleLevels = 8) {
    // 8回のマーチンゲールで合計コストを計算
    // 1 + 2 + 4 + 8 + 16 + 32 + 64 + 128 = 255倍
    const totalMultiplier = Math.pow(2, maxMartingaleLevels) - 1;
    
    // 初期ベット額 = 初期資金 / 合計倍率 / 安全係数(1.2)
    // 安全係数を加えることで、少し余裕を持たせる
    const baseBet = initialFunds / (totalMultiplier * 1.2);
    
    // 通貨に応じて丸める
    if (initialFunds >= 100000) {
        // JPY, KRW - 100円/ウォン単位
        return Math.floor(baseBet / 100) * 100;
    } else if (initialFunds >= 10000) {
        // KRW (小額), CNY - 10単位
        return Math.floor(baseBet / 10) * 10;
    } else if (initialFunds >= 1000) {
        // USD, EUR - 1単位
        return Math.floor(baseBet);
    } else {
        // 小額通貨 - 0.01単位
        return Math.floor(baseBet * 100) / 100;
    }
}

/**
 * 通貨フォーマット関数
 * @param {number} amount - 金額
 * @param {string} currencyCode - 通貨コード
 * @returns {string} フォーマット済み金額
 */
function formatCurrency(amount, currencyCode) {
    const currency = CURRENCIES[currencyCode];
    if (!currency) return amount.toString();
    return currency.format(amount);
}

/**
 * チャートラベル用フォーマット関数
 * @param {number} value - 値
 * @param {string} currencyCode - 通貨コード
 * @returns {string} フォーマット済みラベル
 */
function formatChartLabel(value, currencyCode) {
    const currency = CURRENCIES[currencyCode];
    if (["JPY", "KRW"].includes(currencyCode)) {
        if (value >= 100000000) return (value / 100000000).toFixed(1) + "億";
        if (value >= 10000) return (value / 10000).toFixed(1) + "万";
    } else {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
        if (value >= 1000) return (value / 1000).toFixed(1) + "k";
    }
    return currency.symbol + value;
}

/**
 * 翻訳取得関数
 * @param {string} key - 翻訳キー
 * @param {string} language - 言語コード
 * @returns {string} 翻訳テキスト
 */
function getTranslation(key, language) {
    return translations[language]?.[key] || translations.ja[key] || key;
}

/**
 * 通貨名取得関数
 * @param {string} currencyCode - 通貨コード
 * @param {string} language - 言語コード
 * @returns {string} 通貨名
 */
function getCurrencyName(currencyCode, language) {
    return currencyNames[currencyCode]?.[language] || currencyCode;
}

/**
 * デバウンス関数
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンス処理された関数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}