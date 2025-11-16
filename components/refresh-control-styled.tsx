/**
 * Styled Refresh Control
 *
 * Beautiful pull-to-refresh with proper theming
 */

import { RefreshControl, RefreshControlProps, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BrandColors, ThemeColors } from '@/constants/brand';

interface StyledRefreshControlProps extends Omit<RefreshControlProps, 'colors' | 'tintColor'> {
  // Additional props can be added here
}

export function StyledRefreshControl(props: StyledRefreshControlProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <RefreshControl
      {...props}
      // iOS
      tintColor={BrandColors.loopBlue}
      // Android
      colors={[BrandColors.loopBlue, BrandColors.loopGreen]}
      progressBackgroundColor={colors.card}
    />
  );
}
