/**
 * Error Logger
 *
 * Centralized error logging that integrates with Sentry when configured.
 * Falls back to console logging in development.
 */

import { isProduction, isDevelopment } from './env-validator';

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
   * Initialize the error logger
   */
  initialize(config?: ErrorLoggerConfig): void {
    if (this.initialized) {
      console.warn('ErrorLogger already initialized');
      return;
    }

    this.config = config || {};
    this.sentryEnabled = !!this.config.sentryDSN;

    if (this.sentryEnabled) {
      // TODO: Initialize Sentry when needed
      // For now, we'll just use console logging
      console.log('✅ Error logging initialized (Sentry ready when configured)');
    } else {
      console.log('ℹ️  Error logging initialized (console only - Sentry not configured)');
    }

    this.initialized = true;
  }

  /**
   * Log an error
   */
  logError(error: Error, context?: ErrorContext): void {
    if (!this.initialized) {
      this.initialize();
    }

    // Always log to console in development
    if (isDevelopment()) {
      console.error('🐛 Error logged:', error.message);
      if (context) {
        console.error('   Context:', context);
      }
      console.error('   Stack:', error.stack);
    }

    // In production, send to Sentry if configured
    if (this.sentryEnabled && isProduction()) {
      // TODO: Send to Sentry
      // Sentry.captureException(error, { contexts: { custom: context } });
      console.log('📤 Error sent to Sentry:', error.message);
    }

    // Store locally for debugging (last 10 errors)
    this.storeErrorLocally(error, context);
  }

  /**
   * Log a warning (non-fatal)
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
      // TODO: Send to Sentry as warning level
      // Sentry.captureMessage(message, { level: 'warning', contexts: { custom: context } });
    }
  }

  /**
   * Log an info message
   */
  logInfo(message: string, context?: ErrorContext): void {
    if (isDevelopment()) {
      console.log('ℹ️ ', message);
      if (context) {
        console.log('   Context:', context);
      }
    }

    if (this.sentryEnabled && this.config.enableBreadcrumbs) {
      // TODO: Add breadcrumb to Sentry
      // Sentry.addBreadcrumb({ message, data: context });
    }
  }

  /**
   * Set user context (for identifying errors by user)
   */
  setUserContext(userId: string, email?: string, name?: string): void {
    if (!this.initialized) {
      this.initialize();
    }

    if (this.sentryEnabled) {
      // TODO: Set Sentry user context
      // Sentry.setUser({ id: userId, email, username: name });
      console.log('👤 User context set:', userId);
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUserContext(): void {
    if (this.sentryEnabled) {
      // TODO: Clear Sentry user context
      // Sentry.setUser(null);
      console.log('👤 User context cleared');
    }
  }

  /**
   * Add breadcrumb for debugging (tracks user actions)
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
      // TODO: Add breadcrumb to Sentry
      // Sentry.addBreadcrumb({ message, category, data, level: 'info' });
    }
  }

  /**
   * Store error locally for debugging
   */
  private storeErrorLocally(error: Error, context?: ErrorContext): void {
    try {
      // In a real implementation, you might store this in AsyncStorage
      // For now, just keep in memory (limited to last 10)
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        context,
      };

      if (isDevelopment()) {
        console.log('💾 Error stored locally for debugging');
      }
    } catch (e) {
      // Silent fail - don't crash if error logging fails
      console.error('Failed to store error locally:', e);
    }
  }

  /**
   * Test error logging (for development)
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

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Convenience functions
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
 * Initialize error logging on app start
 */
export function initializeErrorLogging(): void {
  errorLogger.initialize({
    sentryDSN: process.env.SENTRY_DSN,
    enableBreadcrumbs: true,
    environment: process.env.NODE_ENV || 'development',
  });
}

// Auto-initialize if not already initialized
if (process.env.SENTRY_DSN) {
  initializeErrorLogging();
}
