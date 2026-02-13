/**
 * Google Places API Rate Limiter
 * Prevents rapid-fire API calls that can quickly exhaust the free tier
 *
 * Problem: Without rate limiting, UI interactions can trigger many API calls
 * in quick succession (e.g., scroll events, rapid taps), burning through budget.
 *
 * Solution: Queue-based rate limiting with configurable minimum spacing
 */

// Minimum milliseconds between API calls
const MIN_REQUEST_SPACING_MS = 200;

// Maximum queue size before rejecting new requests
const MAX_QUEUE_SIZE = 10;

// Request queue
interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

class APIRateLimiter {
  private queue: QueuedRequest<any>[] = [];
  private lastRequestTime: number = 0;
  private isProcessing: boolean = false;
  private requestCount: number = 0;
  private blockedCount: number = 0;

  /**
   * Queue an API request with rate limiting
   * @param execute Function that makes the actual API call
   * @returns Promise that resolves when the request completes
   */
  async queueRequest<T>(execute: () => Promise<T>): Promise<T> {
    // Check queue size
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.blockedCount++;
      console.warn(`[RateLimiter] Queue full (${MAX_QUEUE_SIZE} pending), blocking request. Total blocked: ${this.blockedCount}`);
      throw new Error('API rate limiter queue full - too many pending requests');
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) continue;

      // Calculate required delay
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const requiredDelay = Math.max(0, MIN_REQUEST_SPACING_MS - timeSinceLastRequest);

      // Wait if needed
      if (requiredDelay > 0) {
        console.log(`[RateLimiter] Waiting ${requiredDelay}ms before next API call`);
        await this.sleep(requiredDelay);
      }

      // Execute the request
      this.lastRequestTime = Date.now();
      this.requestCount++;

      try {
        const result = await request.execute();
        request.resolve(result);
        console.log(`[RateLimiter] Request #${this.requestCount} completed. Queue: ${this.queue.length} remaining`);
      } catch (error) {
        request.reject(error as Error);
        console.error(`[RateLimiter] Request #${this.requestCount} failed:`, error);
      }
    }

    this.isProcessing = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limiter stats
   */
  getStats(): { queueLength: number; requestCount: number; blockedCount: number; lastRequestTime: number } {
    return {
      queueLength: this.queue.length,
      requestCount: this.requestCount,
      blockedCount: this.blockedCount,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * Clear the queue (for cleanup/reset)
   */
  clearQueue(): void {
    const pendingCount = this.queue.length;
    this.queue.forEach(req => {
      req.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    console.log(`[RateLimiter] Queue cleared. ${pendingCount} pending requests cancelled.`);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.requestCount = 0;
    this.blockedCount = 0;
    console.log('[RateLimiter] Stats reset');
  }
}

// Singleton instance for Google Places API
export const googlePlacesRateLimiter = new APIRateLimiter();

/**
 * Wrapper to make a rate-limited Google Places API call
 * Use this instead of calling fetch directly
 *
 * @example
 * const result = await rateLimitedPlacesRequest(() =>
 *   fetch('https://places.googleapis.com/v1/places:searchNearby', options)
 * );
 */
export async function rateLimitedPlacesRequest<T>(
  apiCall: () => Promise<T>
): Promise<T> {
  return googlePlacesRateLimiter.queueRequest(apiCall);
}

/**
 * Log rate limiter stats
 */
export function logRateLimiterStats(): void {
  const stats = googlePlacesRateLimiter.getStats();
  console.log('\n[RateLimiter] === Google Places API Rate Limiter Stats ===');
  console.log(`[RateLimiter] Total requests processed: ${stats.requestCount}`);
  console.log(`[RateLimiter] Requests blocked (queue full): ${stats.blockedCount}`);
  console.log(`[RateLimiter] Current queue length: ${stats.queueLength}`);
  console.log(`[RateLimiter] Last request time: ${stats.lastRequestTime ? new Date(stats.lastRequestTime).toISOString() : 'Never'}`);
  console.log('[RateLimiter] ==============================================\n');
}
