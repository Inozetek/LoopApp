/**
 * Safe Fetch Utility
 *
 * Wraps the native fetch with:
 * - Configurable timeout via AbortSignal.timeout
 * - Retry with exponential backoff (default 3 attempts, 1s/2s/4s)
 * - Special 429 (rate limit) handling — respects Retry-After header
 * - No retry on 4xx errors (except 429) — client errors are not transient
 *
 * Returns the Response object just like normal fetch.
 */

import { logWarning, logError } from '@/utils/error-logger';

export interface SafeFetchOptions {
  /** Request timeout in milliseconds. Default: 10000 */
  timeoutMs?: number;
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff. Default: 1000 */
  baseDelayMs?: number;
  /** Label for error logging, e.g. 'google-places'. Default: 'safeFetch' */
  context?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;

/**
 * Determine whether the given status code is a non-retryable client error.
 * 4xx errors are not retried, EXCEPT 429 (rate limited) which is transient.
 */
function isNonRetryableClientError(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429;
}

/**
 * Parse the Retry-After header value into milliseconds.
 * Supports both delta-seconds ("120") and HTTP-date formats.
 * Returns null if the header is missing or unparsable.
 */
function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;

  // Try delta-seconds first (most common for APIs)
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  // Try HTTP-date format
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safeFetch(
  url: string,
  init?: RequestInit,
  options?: SafeFetchOptions,
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const context = options?.context ?? 'safeFetch';

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Merge timeout signal with any caller-provided signal
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const mergedInit: RequestInit = {
        ...init,
        signal: timeoutSignal,
      };

      const response = await fetch(url, mergedInit);

      // Success — return immediately
      if (response.ok) {
        return response;
      }

      // Non-retryable 4xx (except 429) — return the error response, no retry
      if (isNonRetryableClientError(response.status)) {
        return response;
      }

      // 429 Rate Limited — use Retry-After header if present, otherwise longer backoff
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          // Use Retry-After if available; otherwise double the normal backoff
          const delayMs = retryAfterMs ?? baseDelayMs * Math.pow(2, attempt) * 2;
          // Cap at 60 seconds to avoid absurd waits
          const cappedDelay = Math.min(delayMs, 60_000);

          logWarning(
            `[${context}] 429 rate limited (attempt ${attempt + 1}/${maxRetries + 1}). ` +
            `Retrying in ${cappedDelay}ms`,
          );

          await sleep(cappedDelay);
          continue;
        }
        // Out of retries — return the 429 response
        return response;
      }

      // 5xx or other retryable status — retry with exponential backoff
      if (attempt < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logWarning(
          `[${context}] HTTP ${response.status} (attempt ${attempt + 1}/${maxRetries + 1}). ` +
          `Retrying in ${delayMs}ms`,
        );
        await sleep(delayMs);
        continue;
      }

      // Out of retries — return whatever we got
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt, throw
      if (attempt >= maxRetries) {
        logError(lastError, {
          action: 'safeFetch',
          metadata: { context, url, attempt: attempt + 1, maxRetries: maxRetries + 1 },
        });
        throw lastError;
      }

      // Network error or timeout — retry with exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      logWarning(
        `[${context}] ${lastError.name}: ${lastError.message} (attempt ${attempt + 1}/${maxRetries + 1}). ` +
        `Retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  // Should never reach here, but satisfy TypeScript
  throw lastError ?? new Error(`[${context}] safeFetch failed after ${maxRetries + 1} attempts`);
}
