/**
 * Error Handler Utility
 *
 * Provides centralized error handling and user-friendly error messages
 */

import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface ErrorDetails {
  title?: string;
  message: string;
  code?: string;
  action?: string;
}

/**
 * Error types for better handling
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  PERMISSION = 'PERMISSION',
  VALIDATION = 'VALIDATION',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Get error type from error object
 */
export function getErrorType(error: any): ErrorType {
  if (!error) return ErrorType.UNKNOWN;

  const errorMessage = error?.message?.toLowerCase() || '';

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection')
  ) {
    return ErrorType.NETWORK;
  }

  // Auth errors
  if (
    errorMessage.includes('auth') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('token') ||
    error?.code === '401'
  ) {
    return ErrorType.AUTH;
  }

  // Database errors
  if (
    errorMessage.includes('database') ||
    errorMessage.includes('supabase') ||
    errorMessage.includes('query')
  ) {
    return ErrorType.DATABASE;
  }

  // Permission errors
  if (
    errorMessage.includes('permission') ||
    errorMessage.includes('denied') ||
    errorMessage.includes('location')
  ) {
    return ErrorType.PERMISSION;
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return ErrorType.VALIDATION;
  }

  // API errors
  if (errorMessage.includes('api') || errorMessage.includes('rate limit')) {
    return ErrorType.API;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Get user-friendly error details
 */
export function getErrorDetails(error: any): ErrorDetails {
  const errorType = getErrorType(error);

  switch (errorType) {
    case ErrorType.NETWORK:
      return {
        title: 'Connection Error',
        message: 'Please check your internet connection and try again.',
        code: 'NETWORK_ERROR',
        action: 'Retry',
      };

    case ErrorType.AUTH:
      return {
        title: 'Authentication Error',
        message: 'Your session has expired. Please log in again.',
        code: 'AUTH_ERROR',
        action: 'Log In',
      };

    case ErrorType.DATABASE:
      return {
        title: 'Data Error',
        message: 'There was a problem loading your data. Please try again.',
        code: 'DATABASE_ERROR',
        action: 'Retry',
      };

    case ErrorType.PERMISSION:
      return {
        title: 'Permission Required',
        message: 'This feature requires additional permissions to work properly.',
        code: 'PERMISSION_ERROR',
        action: 'Grant Permission',
      };

    case ErrorType.VALIDATION:
      return {
        title: 'Invalid Input',
        message: error?.message || 'Please check your input and try again.',
        code: 'VALIDATION_ERROR',
        action: 'OK',
      };

    case ErrorType.API:
      return {
        title: 'Service Unavailable',
        message: 'The service is temporarily unavailable. Please try again later.',
        code: 'API_ERROR',
        action: 'Retry',
      };

    default:
      return {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again.',
        code: 'UNKNOWN_ERROR',
        action: 'Retry',
      };
  }
}

/**
 * Show error alert with haptic feedback
 */
export function showErrorAlert(
  error: any,
  onRetry?: () => void,
  customMessage?: string
): void {
  const details = getErrorDetails(error);

  // Trigger error haptic feedback
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

  // Log error for debugging
  console.error(`[${details.code}]`, error);

  const buttons: any[] = [
    {
      text: 'Cancel',
      style: 'cancel',
      onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    },
  ];

  if (onRetry) {
    buttons.push({
      text: details.action || 'Retry',
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onRetry();
      },
    });
  }

  Alert.alert(
    details.title || 'Error',
    customMessage || details.message,
    buttons,
    { cancelable: true }
  );
}

/**
 * Handle error with automatic type detection and user feedback
 */
export function handleError(
  error: any,
  context: string = 'operation',
  onRetry?: () => void
): void {
  console.error(`Error in ${context}:`, error);

  // Special handling for specific error types
  const errorType = getErrorType(error);

  if (errorType === ErrorType.PERMISSION) {
    // Permission errors are often handled elsewhere, just log
    console.log(`Permission error in ${context}, handled by component`);
    return;
  }

  showErrorAlert(error, onRetry);
}

/**
 * Async error wrapper for try-catch blocks
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string = 'operation',
  onRetry?: () => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context, onRetry);
    return null;
  }
}

/**
 * Validate required fields
 */
export function validateRequired(
  fields: Record<string, any>,
  fieldNames: Record<string, string>
): string | null {
  for (const [key, label] of Object.entries(fieldNames)) {
    const value = fields[key];
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${label} is required`;
    }
  }
  return null;
}

/**
 * Check if error is recoverable (can retry)
 */
export function isRecoverableError(error: any): boolean {
  const errorType = getErrorType(error);
  return [
    ErrorType.NETWORK,
    ErrorType.API,
    ErrorType.DATABASE,
  ].includes(errorType);
}

/**
 * Create retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRecoverableError(error)) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
