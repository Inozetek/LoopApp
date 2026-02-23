import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { logError } from '@/utils/error-logger';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  /** Screen name for error logging context */
  screen?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches render errors in child components.
 * Prevents a single screen crash from taking down the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, {
      screen: this.props.screen ?? 'unknown',
      action: 'render_crash',
      metadata: { componentStack: errorInfo.componentStack ?? '' },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          message={this.props.fallbackMessage}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/** Theme-aware fallback UI shown when a screen crashes. */
function ErrorFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <Text style={[styles.icon, dark && styles.iconDark]}>!</Text>
      <Text style={[styles.title, dark && styles.titleDark]}>Something went wrong</Text>
      <Text style={[styles.message, dark && styles.messageDark]}>
        {message || 'This screen encountered an error. Your other tabs still work.'}
      </Text>
      <Pressable
        style={[styles.button, dark && styles.buttonDark]}
        onPress={onRetry}
        accessibilityLabel="Try again"
        accessibilityRole="button"
        accessibilityHint="Reload this screen"
      >
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/**
 * Convenience wrapper: a screen-level error boundary.
 * Use this inside each tab screen to isolate crashes.
 *
 * ```tsx
 * export default function CalendarScreen() {
 *   return (
 *     <ScreenErrorBoundary screen="Calendar">
 *       {/* screen content *\/}
 *     </ScreenErrorBoundary>
 *   );
 * }
 * ```
 */
export function ScreenErrorBoundary({
  children,
  screen,
}: {
  children: ReactNode;
  screen: string;
}) {
  return (
    <ErrorBoundary screen={screen} fallbackMessage={`The ${screen} screen hit an error. Tap below to reload it.`}>
      {children}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FAFAFA',
  },
  containerDark: {
    backgroundColor: '#111111',
  },
  icon: {
    fontSize: 48,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 16,
    width: 72,
    height: 72,
    lineHeight: 72,
    textAlign: 'center',
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    overflow: 'hidden',
  },
  iconDark: {
    backgroundColor: '#3B1111',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  titleDark: {
    color: '#F3F4F6',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  messageDark: {
    color: '#9CA3AF',
  },
  button: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonDark: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
