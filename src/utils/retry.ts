import { LLMApiError } from '../types';

const MAX_BACKOFF_MS = 60000;

// LLM APIの一時的なエラーに対する指数バックオフ再試行ヘルパー
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: LLMApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof LLMApiError)) {
        throw error;
      }

      // レート制限とサーバーエラーのみリトライする
      if (error.status !== 429 && error.status < 500) {
        throw error;
      }

      lastError = error;
      if (attempt === maxRetries) {
        break;
      }

      const baseBackoff = Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);
      let waitMs = baseBackoff;

      const headerMap = error.headers
        ? Object.fromEntries(
            Object.entries(error.headers).map(([k, v]) => [k.toLowerCase(), v])
          )
        : null;

      if (headerMap) {
        const retryAfterMs = headerMap['retry-after-ms'];
        if (retryAfterMs) {
          const parsed = parseFloat(retryAfterMs);
          if (!Number.isNaN(parsed) && parsed >= 0 && parsed < MAX_BACKOFF_MS) {
            waitMs = parsed;
          }
        }

        if (waitMs === baseBackoff) {
          const retryAfter = headerMap['retry-after'];
          if (retryAfter) {
            const seconds = parseFloat(retryAfter);
            let parsed: number | null = null;
            if (!Number.isNaN(seconds)) {
              parsed = seconds * 1000;
            } else {
              const date = new Date(retryAfter);
              if (!Number.isNaN(date.getTime())) {
                parsed = date.getTime() - Date.now();
              }
            }
            if (parsed !== null && parsed >= 0 && parsed < MAX_BACKOFF_MS) {
              waitMs = parsed;
            }
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}
