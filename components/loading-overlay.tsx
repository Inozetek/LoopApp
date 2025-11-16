/**
 * Loading Overlay
 *
 * Full-screen or inline loading indicator with optional message
 */

import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius, BrandColors } from '@/constants/brand';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({
  visible,
  message = 'Loading...',
  fullScreen = true,
}: LoadingOverlayProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  if (!visible) return null;

  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <BlurView
        intensity={80}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={styles.blur}
      />
      <View style={[styles.contentBox, { backgroundColor: colors.card }]}>
        <ActivityIndicator size="large" color={BrandColors.loopBlue} />
        {message && (
          <Text style={[styles.message, Typography.bodyMedium, { color: colors.text }]}>
            {message}
          </Text>
        )}
      </View>
    </View>
  );

  if (fullScreen) {
    return (
      <Modal transparent visible={visible} animationType="fade">
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  fullScreen: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  contentBox: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  message: {
    marginTop: Spacing.md,
    textAlign: 'center',
  },
});
