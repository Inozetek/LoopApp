/**
 * Block Activity Confirmation Modal
 * Shown when user taps "Not Interested" on a recommendation card
 */

import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BorderRadius } from '@/constants/brand';

interface BlockActivityModalProps {
  visible: boolean;
  placeName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BlockActivityModal({
  visible,
  placeName,
  onConfirm,
  onCancel,
}: BlockActivityModalProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel}>
          <Pressable style={[styles.modal, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${colors.error}20` }]}>
              <IconSymbol name="hand.raised.fill" size={32} color={colors.error} />
            </View>

            {/* Title */}
            <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]}>
              Never Show Again?
            </Text>

            {/* Message */}
            <Text style={[styles.message, Typography.body, { color: colors.textSecondary }]}>
              Hide <Text style={{ fontWeight: '600', color: colors.text }}>{placeName}</Text> permanently?
              {'\n\n'}
              You can undo this in Settings → Blocked Places.
            </Text>

            {/* Buttons */}
            <View style={styles.buttons}>
              <Pressable
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleCancel}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.confirmButton, { backgroundColor: colors.error }]}
                onPress={handleConfirm}
              >
                <Text style={[styles.buttonText, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Block
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    marginBottom: Spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    // Styling in component
  },
  confirmButton: {
    // Styling in component
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
