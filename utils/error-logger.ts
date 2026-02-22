/**
 * Error Logger
 *
 * Centralized error logging that integrates with Sentry when configured.
 * Falls back to console logging in development.
 *
 * Sentry is initialized via lib/sentry.ts (called from app/_layout.tsx).
 * This module calls Sentry APIs directly — no duplicate init here.
 */

import { isProduction, isDevelopment } from './env-validator';
import { Sentry } from '@/lib/sentry';

interface ErrorContext {
  userId?: string;
  screen?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface ErrorLoggerConfig {
  sentryDSN?: string;
  enableBreadcrumbs?: boolean;
  environment?: string;
}

class ErrorLogger {
  private initialized: boolean = false;
  private sentryEnabled: boolean = false;
  private config: ErrorLoggerConfig = {};

  /**
   * Initialize the error logger.
   * Sentry itself is already initialized in lib/sentry.ts — this just records
   * whether a DSN was provided so callers can gate Sentry calls.
   */
  initialize(config?: ErrorLoggerConfig): void {
    if (this.initialized) {
      console.warn('ErrorLogger already initialized');
      return;
    }

    this.config = config || {};
    this.sentryEnabled = !!this.config.sentryDSN;

    if (this.sentryEnabled) {
      console.log('✅ Error logging initialized (Sentry active)');
    } else {
      console.log('ℹ️  Error logging initialized (console only — set EXPO_PUBLIC_SENTRY_DSN to enable Sentry)');
    }

    this.initialized = true;
  }

  /**
   * Log an error.
   */
  logError(error: Error, context?: ErrorContext): void {
    if (!this.initialized) {
      this.initialize();
    }

    // Always log to console in development.
    if (isDevelopment()) {
      console.error('🐛 Error logged:', error.message);
      if (context) {
        console.error('   Context:', context);
      }
      console.error('   Stack:', error.stack);
    }

    // Send to Sentry in production (or when a real DSN is configured).
    if (this.sentryEnabled && isProduction()) {
      Sentry.captureException(error, {
        contexts: { custom: context as Record<string, unknown> },
      });
    }

    // Store locally for debugging (last 10 errors).
    this.storeErrorLocally(error, context);
  }

  /**
   * Log a warning (non-fatal).
   */
  logWarning(message: string, context?: ErrorContext): void {
    if (!this.initialized) {
      this.initialize();
    }

    console.warn('⚠️  Warning:', message);
    if (context && isDevelopment()) {
      console.warn('   Context:', context);
    }

    if (this.sentryEnabled && isProduction()) {
      Sentry.withScope((scope) => {
        if (context) {
          scope.setContext('custom', context as Record<string, unknown>);
        }
        Sentry.captureMessage(message, 'warning');
      });
    }
  }

  /**
   * Log an info message (breadcrumb in Sentry).
   */
  logInfo(message: string, context?: ErrorContext): void {
    if (isDevelopment()) {
      console.log('ℹ️ ', message);
      if (context) {
        console.log('   Context:', context);
      }
    }

    if (this.sentryEnabled && this.config.enableBreadcrumbs) {
      Sentry.addBreadcrumb({
        message,
        data: context as Record<string, unknown> | undefined,
        level: 'info',
      });
    }
  }

  /**
   * Set user context (for identifying errors by user).
   */
  setUserContext(userId: string, email?: string, name?: string): void {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.sentryEnabled) {
      Sentry.setUser({ id: userId, email, username: name });
      if (isDevelopment()) {
        console.log('👤 User context set in Sentry:', userId);
      }
    }
  }

  /**
   * Clear user context (on logout).
   */
  clearUserContext(): void {
    if (this.sentryEnabled) {
      Sentry.setUser(null);
      if (isDevelopment()) {
        console.log('👤 User context cleared from Sentry');
      }
    }
  }

  /**
   * Add breadcrumb for debugging (tracks user actions).
   */
  addBreadcrumb(
    message: string,
    category: string = 'user-action',
    data?: Record<string, any>
  ): void {
    if (!this.initialized) {
      this.initialize();
    }

    if (isDevelopment()) {
      console.log(`🍞 [${category}] ${message}`, data || '');
    }

    if (this.sentryEnabled && this.config.enableBreadcrumbs) {
      Sentry.addBreadcrumb({ message, category, data, level: 'info' });
    }
  }

  /**
   * Store error locally for debugging.
   */
  private storeErrorLocally(error: Error, context?: ErrorContext): void {
    try {
      // In a real implementation, you might store this in AsyncStorage.
      // For now, just keep in memory (limited to last 10).
      const _errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        context,
      };

      if (isDevelopment()) {
        console.log('💾 Error stored locally for debugging');
      }
    } catch (e) {
      // Silent fail — don't crash if error logging itself fails.
      console.error('Failed to store error locally:', e);
    }
  }

  /**
   * Test error logging (for development).
   */
  test(): void {
    console.log('\n🧪 Testing error logger...\n');

    this.logInfo('Test info message');
    this.logWarning('Test warning message');

    try {
      throw new Error('Test error for logging');
    } catch (error) {
      this.logError(error as Error, {
        screen: 'TestScreen',
        action: 'testAction',
      });
    }

    console.log('\n✅ Error logger test complete\n');
  }
}

// Create singleton instance.
export const errorLogger = new ErrorLogger();

// Convenience functions.
export function logError(error: Error, context?: ErrorContext): void {
  errorLogger.logError(error, context);
}

export function logWarning(message: string, context?: ErrorContext): void {
  errorLogger.logWarning(message, context);
}

export function logInfo(message: string, context?: ErrorContext): void {
  errorLogger.logInfo(message, context);
}

export function setUserContext(
  userId: string,
  email?: string,
  name?: string
): void {
  errorLogger.setUserContext(userId, email, name);
}

export function clearUserContext(): void {
  errorLogger.clearUserContext();
}

export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, any>
): void {
  errorLogger.addBreadcrumb(message, category, data);
}

/**
 * Initialize error logging on app start.
 * Called from app/_layout.tsx after Sentry itself has been initialized
 * via initSentry() in lib/sentry.ts.
 */
export function initializeErrorLogging(): void {
  errorLogger.initialize({
    // Use the public env var (EXPO_PUBLIC_ prefix required for RN bundles).
    // Fall back to the legacy SENTRY_DSN for backward compatibility.
    sentryDSN:
      process.env.EXPO_PUBLIC_SENTRY_DSN ||
      process.env.SENTRY_DSN,
    enableBreadcrumbs: true,
    environment: process.env.NODE_ENV || 'development',
  });
}

// Auto-initialize if a DSN is already present (e.g. server-side or CI).
if (process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
  initializeErrorLogging();
}
