// /api/utils/error-handler.js
/**
 * 本番環境で詳細なエラー情報を漏らさないためのハンドラー
 */
class APIError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

function handleAPIError(error, res, isDevelopment = false) {
    console.error('API Error:', {
        message: error.message,
        code: error.code,
        stack: isDevelopment ? error.stack : undefined
    });

    const statusCode = error.statusCode || 500;
    const response = {
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR'
    };

    // 開発環境でのみ詳細情報を返す
    if (isDevelopment && error.details) {
        response.details = error.details;
    }

    return res.status(statusCode).json(response);
}

module.exports = { APIError, handleAPIError };