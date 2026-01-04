import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandColors } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ToastNotificationProps {
  visible: boolean;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  duration?: number; // milliseconds
  onComplete?: () => void;
}

export function ToastNotification({
  visible,
  message,
  icon = 'checkmark-circle',
  duration = 2000,
  onComplete,
}: ToastNotificationProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (visible) {
      // Slide up and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after duration
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 100,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onComplete?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Reset position
      translateY.setValue(100);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          isDark ? styles.toastDark : styles.toastLight,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={BrandColors.loopGreen} />
        <Text style={[styles.message, isDark ? styles.messageDark : styles.messageLight]}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    maxWidth: '90%',
    minWidth: 200,
  },
  toastLight: {
    backgroundColor: '#ffffff',
  },
  toastDark: {
    backgroundColor: '#2c2c2e',
  },
  message: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  messageLight: {
    color: '#1c1c1e',
  },
  messageDark: {
    color: '#ffffff',
  },
});
