import { Text, TextProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface TypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body1' | 'body2' | 'caption' | 'label';
  color?: 'primary' | 'secondary' | 'disabled' | 'error' | 'success' | 'inherit';
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}

export function Typography({
  variant = 'body1',
  color = 'primary',
  weight,
  align = 'left',
  children,
  style,
  ...props
}: TypographyProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getTextStyle = () => {
    const variantStyles = {
      h1: styles.h1,
      h2: styles.h2,
      h3: styles.h3,
      h4: styles.h4,
      body1: styles.body1,
      body2: styles.body2,
      caption: styles.caption,
      label: styles.label,
    };

    const colorMap = {
      primary: colors.text,
      secondary: colors.textSecondary,
      disabled: colors.textDisabled,
      error: colors.expense,
      success: colors.income,
      inherit: 'inherit',
    };

    const weightMap = {
      '400': '400' as const,
      '500': '500' as const,
      '600': '600' as const,
      '700': '700' as const,
    };

    return [
      variantStyles[variant],
      {
        color: colorMap[color],
        textAlign: align,
        ...(weight && { fontWeight: weightMap[weight] }),
      },
      style,
    ];
  };

  return (
    <Text {...props} style={getTextStyle()}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
});