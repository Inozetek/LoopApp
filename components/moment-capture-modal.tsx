/**
 * Moment Capture Modal
 *
 * Camera/gallery picker with place tagging for creating new moments.
 *
 * Features:
 * - Camera or gallery photo selection
 * - Photo preview
 * - Caption input
 * - "Tag to Place" toggle (makes permanent)
 * - Tag friends selector
 * - Visibility selector (Friends / Everyone)
 * - Share button
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { BrandColors, Spacing } from '@/constants/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { MomentVisibility, MomentPlace, CreateMomentParams } from '@/types/moment';
import { createMoment } from '@/services/moments-service';
import { Friend } from '@/types/friend';

interface MomentCaptureModalProps {
  visible: boolean;
  place?: MomentPlace;
  currentUserId: string;
  friends?: Friend[];
  onClose: () => void;
  onSuccess?: () => void;
}

type CaptureStep = 'select' | 'preview';

export function MomentCaptureModal({
  visible,
  place,
  currentUserId,
  friends = [],
  onClose,
  onSuccess,
}: MomentCaptureModalProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [step, setStep] = useState<CaptureStep>('select');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<MomentVisibility>('friends');
  const [isTaggedToPlace, setIsTaggedToPlace] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Reset state when modal opens/closes
  const resetState = useCallback(() => {
    setStep('select');
    setPhotoUri(null);
    setCaption('');
    setVisibility('friends');
    setIsTaggedToPlace(false);
    setSelectedFriendIds([]);
    setIsUploading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Launch camera
  const handleCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to capture moments.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhotoUri(result.assets[0].uri);
        setStep('preview');
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  }, []);

  // Launch gallery
  const handleGallery = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow photo library access to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPhotoUri(result.assets[0].uri);
        setStep('preview');
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open photo library. Please try again.');
    }
  }, []);

  // Toggle friend selection
  const toggleFriend = useCallback((friendId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  }, []);

  // Share moment
  const handleShare = useCallback(async () => {
    if (!photoUri || !place) {
      Alert.alert('Error', 'Missing photo or place information.');
      return;
    }

    setIsUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const params: CreateMomentParams = {
        placeId: place.id,
        placeName: place.name,
        placeLocation: place.location,
        placeAddress: place.address,
        photoUri,
        caption: caption.trim() || undefined,
        visibility,
        isTaggedToPlace,
        taggedFriendIds: selectedFriendIds.length > 0 ? selectedFriendIds : undefined,
        captureTrigger: 'manual',
      };

      const result = await createMoment(currentUserId, params);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleClose();
        onSuccess?.();
      } else {
        Alert.alert('Upload Failed', result.error || 'Failed to share moment. Please try again.');
      }
    } catch (error) {
      console.error('Share moment error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [
    photoUri,
    place,
    caption,
    visibility,
    isTaggedToPlace,
    selectedFriendIds,
    currentUserId,
    handleClose,
    onSuccess,
  ]);

  // Go back to selection
  const handleBack = useCallback(() => {
    setStep('select');
    setPhotoUri(null);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {step === 'preview' ? (
            <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButton} />
          )}

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {step === 'select' ? 'New Moment' : 'Share Moment'}
          </Text>

          <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          {step === 'select' ? (
            /* Photo Selection Step */
            <View style={styles.selectContainer}>
              {/* Place info */}
              {place && (
                <View style={[styles.placeCard, { backgroundColor: colors.card }]}>
                  <Ionicons name="location" size={20} color={BrandColors.loopBlue} />
                  <View style={styles.placeTextContainer}>
                    <Text style={[styles.placeName, { color: colors.text }]}>
                      {place.name}
                    </Text>
                    {place.address && (
                      <Text style={[styles.placeAddress, { color: colors.icon }]}>
                        {place.address}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Camera / Gallery buttons */}
              <View style={styles.optionButtons}>
                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: colors.card }]}
                  onPress={handleCamera}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
                    style={styles.optionIconContainer}
                  >
                    <Ionicons name="camera" size={32} color="white" />
                  </LinearGradient>
                  <Text style={[styles.optionText, { color: colors.text }]}>Take Photo</Text>
                  <Text style={[styles.optionSubtext, { color: colors.icon }]}>
                    Capture the moment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: colors.card }]}
                  onPress={handleGallery}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.border }]}>
                    <Ionicons name="images" size={32} color={BrandColors.loopBlue} />
                  </View>
                  <Text style={[styles.optionText, { color: colors.text }]}>Choose Photo</Text>
                  <Text style={[styles.optionSubtext, { color: colors.icon }]}>
                    From your library
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Preview & Options Step */
            <ScrollView style={styles.previewContainer} showsVerticalScrollIndicator={false}>
              {/* Photo preview */}
              {photoUri && (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} />
                </View>
              )}

              {/* Caption input */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.captionInput, { color: colors.text }]}
                  placeholder="Write a caption..."
                  placeholderTextColor={colors.icon}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={200}
                />
                <Text style={[styles.charCount, { color: colors.icon }]}>
                  {caption.length}/200
                </Text>
              </View>

              {/* Place info */}
              {place && (
                <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                  <View style={styles.placeRow}>
                    <Ionicons name="location" size={20} color={BrandColors.loopBlue} />
                    <Text
                      style={[styles.placeInlineText, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {place.name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Tag to place toggle */}
              <View style={[styles.toggleSection, { backgroundColor: colors.card }]}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="pin" size={20} color={BrandColors.loopBlue} />
                  <View style={styles.toggleTextContainer}>
                    <Text style={[styles.toggleTitle, { color: colors.text }]}>
                      Tag to Place
                    </Text>
                    <Text style={[styles.toggleSubtitle, { color: colors.icon }]}>
                      Make this permanent content for {place?.name || 'this place'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isTaggedToPlace}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsTaggedToPlace(value);
                    // If tagged to place, visibility should be everyone
                    if (value) setVisibility('everyone');
                  }}
                  trackColor={{ false: colors.border, true: BrandColors.loopBlue }}
                  thumbColor="white"
                />
              </View>

              {/* Visibility selector */}
              <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Visibility</Text>
                <View style={styles.visibilityOptions}>
                  <TouchableOpacity
                    style={[
                      styles.visibilityOption,
                      visibility === 'friends' && styles.visibilityOptionSelected,
                      visibility === 'friends' && { borderColor: BrandColors.loopBlue },
                    ]}
                    onPress={() => {
                      if (!isTaggedToPlace) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setVisibility('friends');
                      }
                    }}
                    disabled={isTaggedToPlace}
                  >
                    <Ionicons
                      name="people"
                      size={20}
                      color={visibility === 'friends' ? BrandColors.loopBlue : colors.icon}
                    />
                    <Text
                      style={[
                        styles.visibilityText,
                        { color: visibility === 'friends' ? BrandColors.loopBlue : colors.icon },
                      ]}
                    >
                      Friends Only
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.visibilityOption,
                      visibility === 'everyone' && styles.visibilityOptionSelected,
                      visibility === 'everyone' && { borderColor: BrandColors.loopBlue },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setVisibility('everyone');
                    }}
                  >
                    <Ionicons
                      name="globe"
                      size={20}
                      color={visibility === 'everyone' ? BrandColors.loopBlue : colors.icon}
                    />
                    <Text
                      style={[
                        styles.visibilityText,
                        { color: visibility === 'everyone' ? BrandColors.loopBlue : colors.icon },
                      ]}
                    >
                      Everyone
                    </Text>
                  </TouchableOpacity>
                </View>

                {isTaggedToPlace && (
                  <Text style={[styles.visibilityNote, { color: colors.icon }]}>
                    Tagged moments are visible to everyone
                  </Text>
                )}
              </View>

              {/* Tag friends (simplified for MVP) */}
              {friends.length > 0 && (
                <View style={[styles.inputSection, { backgroundColor: colors.card }]}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Tag Friends</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.friendTags}>
                      {friends.slice(0, 10).map((friend) => (
                        <TouchableOpacity
                          key={friend.id}
                          style={[
                            styles.friendTag,
                            selectedFriendIds.includes(friend.id) && styles.friendTagSelected,
                            selectedFriendIds.includes(friend.id) && {
                              borderColor: BrandColors.loopBlue,
                              backgroundColor: `${BrandColors.loopBlue}15`,
                            },
                          ]}
                          onPress={() => toggleFriend(friend.id)}
                        >
                          {friend.profilePictureUrl ? (
                            <Image
                              source={{ uri: friend.profilePictureUrl }}
                              style={styles.friendTagAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.friendTagAvatarPlaceholder,
                                { backgroundColor: colors.border },
                              ]}
                            >
                              <Text style={styles.friendTagInitial}>
                                {friend.name.charAt(0)}
                              </Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.friendTagName,
                              {
                                color: selectedFriendIds.includes(friend.id)
                                  ? BrandColors.loopBlue
                                  : colors.text,
                              },
                            ]}
                          >
                            {friend.name.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Share button */}
              <TouchableOpacity
                style={[styles.shareButton, isUploading && styles.shareButtonDisabled]}
                onPress={handleShare}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.shareButtonGradient}
                >
                  {isUploading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={20} color="white" />
                      <Text style={styles.shareButtonText}>Share Moment</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Info text */}
              <Text style={[styles.infoText, { color: colors.icon }]}>
                {isTaggedToPlace
                  ? 'This moment will be permanently visible on the place page.'
                  : 'This moment will expire after 24 hours.'}
              </Text>

              <View style={{ height: insets.bottom + Spacing.xl }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  selectContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  placeTextContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  placeAddress: {
    fontSize: 13,
    marginTop: 2,
  },
  optionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 16,
    gap: Spacing.sm,
  },
  optionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionSubtext: {
    fontSize: 13,
  },
  previewContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  previewImageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  inputSection: {
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  captionInput: {
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeInlineText: {
    fontSize: 15,
    flex: 1,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visibilityOptionSelected: {
    borderWidth: 2,
  },
  visibilityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  visibilityNote: {
    fontSize: 12,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  friendTags: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  friendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs,
    paddingRight: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: Spacing.xs,
  },
  friendTagSelected: {
    borderWidth: 2,
  },
  friendTagAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  friendTagAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendTagInitial: {
    fontSize: 12,
    fontWeight: '600',
  },
  friendTagName: {
    fontSize: 13,
    fontWeight: '500',
  },
  shareButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  shareButtonDisabled: {
    opacity: 0.7,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
});
