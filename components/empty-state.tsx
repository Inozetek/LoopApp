import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeColors, Typography, Spacing, BrandColors } from '@/constants/brand';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: any;
}

export function EmptyState({
  title = 'No Recommendations Yet',
  message = 'Pull down to refresh and discover amazing activities near you!',
  icon = 'star.fill',
}: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const colors = ThemeColors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.backgroundSecondary }]}>
        <IconSymbol name={icon} size={48} color={colors.textSecondary} />
      </View>
      <Text style={[styles.title, Typography.titleLarge, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.message, Typography.bodyMedium, { color: colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
