// /public/assets/js/utils/helpers.js

const CURRENCIES = {
    JPY: {
        symbol: "¥",
        initialFunds: 100000,
        initialBet: 500,
        step: 100,
        format: (value) => `¥${value.toLocaleString("ja-JP")}`
    },
    USD: {
        symbol: "$",
        initialFunds: 1000,
        initialBet: 5,
        step: 1,
        format: (value) => `$${value.toLocaleString("en-US")}`
    },
    EUR: {
        symbol: "€",
        initialFunds: 900,
        initialBet: 5,
        step: 1,
        format: (value) => `€${value.toLocaleString("de-DE")}`
    },
    KRW: {
        symbol: "₩",
        initialFunds: 1200000,
        initialBet: 6000,
        step: 1000,
        format: (value) => `₩${value.toLocaleString("ko-KR")}`
    },
    CNY: {
        symbol: "¥",
        initialFunds: 7000,
        initialBet: 35,
        step: 1,
        format: (value) => `¥${value.toLocaleString("zh-CN")}`
    }
};

function formatCurrency(amount, currencyCode) {
    const currency = CURRENCIES[currencyCode];
    if (!currency) return amount.toString();
    return currency.format(amount);
}

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

function getTranslation(key, language) {
    return translations[language]?.[key] || translations.ja[key] || key;
}

function getCurrencyName(currencyCode, language) {
    return currencyNames[currencyCode]?.[language] || currencyCode;
}

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