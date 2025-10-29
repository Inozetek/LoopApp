// @ts-nocheck - Phase 2 feature
/**
 * Referral Share Modal - Viral Growth UI (Phase 2)
 *
 * Makes it super easy to invite friends via:
 * - SMS
 * - WhatsApp
 * - Instagram
 * - Facebook
 * - Copy link
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  Clipboard,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { BrandColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/brand';
import {
  getUserReferralCode,
  getReferralShareMessage,
  getReferralShareLink,
  trackReferralShare,
} from '@/services/referral-service';

interface ReferralShareModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
}

export function ReferralShareModal({ visible, onClose, userId, userName }: ReferralShareModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [referralCode, setReferralCode] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadReferralCode();
    }
  }, [visible]);

  const loadReferralCode = async () => {
    setLoading(true);
    const code = await getUserReferralCode(userId);
    setReferralCode(code || '');
    setLoading(false);
  };

  const shareMessage = getReferralShareMessage(referralCode, userName);
  const shareLink = getReferralShareLink(referralCode);

  const handleShare = async (method: 'sms' | 'whatsapp' | 'instagram' | 'facebook' | 'link' | 'copy') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Track analytics
    await trackReferralShare(userId, method);

    switch (method) {
      case 'sms':
        await shareSMS();
        break;
      case 'whatsapp':
        await shareWhatsApp();
        break;
      case 'instagram':
        await shareInstagram();
        break;
      case 'facebook':
        await shareFacebook();
        break;
      case 'link':
        await shareNative();
        break;
      case 'copy':
        await copyLink();
        break;
    }
  };

  const shareSMS = async () => {
    try {
      const url = `sms:?body=${encodeURIComponent(shareMessage)}`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not open SMS app');
    }
  };

  const shareWhatsApp = async () => {
    try {
      const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
      const canOpen = await Linking.canOpenURL(url);

      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share via this method');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open WhatsApp');
    }
  };

  const shareInstagram = async () => {
    try {
      // Instagram doesn't support direct message sharing via URL
      // Copy link and guide user to share manually
      await Clipboard.setStringAsync(shareLink);
      Alert.alert(
        'Link Copied!',
        'Open Instagram and paste the link in your story or DM to share with friends',
        [{ text: 'Open Instagram', onPress: () => Linking.openURL('instagram://') }, { text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Could not copy link');
    }
  };

  const shareFacebook = async () => {
    try {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`;
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not open Facebook');
    }
  };

  const shareNative = async () => {
    try {
      await Share.share({
        message: shareMessage,
        url: shareLink,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(shareLink);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied!', 'Referral link copied to clipboard');
    } catch (error) {
      Alert.alert('Error', 'Could not copy link');
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Invite Friends</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Referral Code Display */}
            <View style={[styles.codeContainer, { backgroundColor: BrandColors.loopBlue + '10' }]}>
              <Text style={[styles.codeLabel, { color: colors.icon }]}>Your Referral Code</Text>
              <Text style={[styles.code, { color: BrandColors.loopBlue }]}>{referralCode}</Text>
              <Text style={[styles.codeDescription, { color: colors.text }]}>
                Share this code with friends to get rewards!
              </Text>
            </View>

            {/* Reward Info */}
            <View style={styles.rewardInfo}>
              <Text style={[styles.rewardTitle, { color: colors.text }]}>🎁 Invite 3 friends, get 1 month free!</Text>
              <Text style={[styles.rewardDescription, { color: colors.icon }]}>
                You get: 1 month Loop Plus for every 3 friends who join
              </Text>
              <Text style={[styles.rewardDescription, { color: colors.icon }]}>
                They get: 7 days Loop Plus free to start
              </Text>
            </View>

            {/* Share Buttons */}
            <View style={styles.shareButtons}>
              <ShareButton
                icon="chatbubble-ellipses"
                label="SMS"
                color="#34C759"
                onPress={() => handleShare('sms')}
              />
              <ShareButton
                icon="logo-whatsapp"
                label="WhatsApp"
                color="#25D366"
                onPress={() => handleShare('whatsapp')}
              />
              <ShareButton
                icon="logo-instagram"
                label="Instagram"
                color="#E1306C"
                onPress={() => handleShare('instagram')}
              />
              <ShareButton
                icon="logo-facebook"
                label="Facebook"
                color="#1877F2"
                onPress={() => handleShare('facebook')}
              />
              <ShareButton
                icon="share-outline"
                label="More"
                color={BrandColors.loopBlue}
                onPress={() => handleShare('link')}
              />
              <ShareButton
                icon="copy-outline"
                label="Copy Link"
                color="#FF9500"
                onPress={() => handleShare('copy')}
              />
            </View>

            {/* Preview Message */}
            <View style={[styles.previewContainer, { borderColor: colors.icon + '30' }]}>
              <Text style={[styles.previewLabel, { color: colors.icon }]}>Message Preview:</Text>
              <Text style={[styles.previewText, { color: colors.text }]}>{shareMessage}</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface ShareButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

function ShareButton({ icon, label, color, onPress }: ShareButtonProps) {
  return (
    <TouchableOpacity style={styles.shareButton} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.shareIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.shareLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  codeContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  code: {
    fontSize: 32,
    fontWeight: Typography.weights.bold,
    letterSpacing: 4,
    marginBottom: Spacing.xs,
  },
  codeDescription: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  rewardInfo: {
    marginBottom: Spacing.xl,
  },
  rewardTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  rewardDescription: {
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  shareButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  shareButton: {
    width: '30%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  shareIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    ...Shadows.sm,
  },
  shareLabel: {
    fontSize: Typography.sizes.xs,
    color: '#8E8E93',
  },
  previewContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: Typography.sizes.xs,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: Typography.sizes.sm,
    lineHeight: 20,
  },
});
