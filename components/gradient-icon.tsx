/**
 * Gradient Icon Component
 * Creates a gradient mask for tab bar icons
 * Mint Green → Loop Blue gradient for "For You" tab
 */

import React from 'react';
import { View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandColors } from '@/constants/brand';

interface GradientIconProps {
  name: string;
  size: number;
  focused: boolean;
}

export function GradientIcon({ name, size, focused }: GradientIconProps) {
  // If not focused, use default gray color
  if (!focused) {
    return <IconSymbol size={size} name={name as any} color={BrandColors.veryLightGray} />;
  }

  return (
    <MaskedView
      maskElement={
        <View style={{ backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <IconSymbol size={size} name={name as any} color="white" />
        </View>
      }
    >
      <LinearGradient
        colors={[BrandColors.loopGreen, BrandColors.loopBlueDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
}
