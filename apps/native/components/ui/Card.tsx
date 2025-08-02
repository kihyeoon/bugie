import {
  View,
  ViewProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface CardProps extends ViewProps {
  variant?: 'filled' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  onPress?: () => void;
  pressable?: boolean;
  children: React.ReactNode;
}

export function Card({
  variant = 'filled',
  padding = 'medium',
  onPress,
  pressable = false,
  children,
  style,
  ...props
}: CardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getCardStyle = () => {
    const baseStyle = styles.base;

    const paddingStyles = {
      none: styles.paddingNone,
      small: styles.paddingSmall,
      medium: styles.paddingMedium,
      large: styles.paddingLarge,
    };

    const variantStyles = {
      filled: {
        backgroundColor: colors.background,
      },
      outlined: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      },
      elevated: {
        backgroundColor: colors.background,
        ...styles.elevated,
      },
    };

    return [baseStyle, paddingStyles[padding], variantStyles[variant], style];
  };

  const content = (
    <View {...props} style={getCardStyle()}>
      {children}
    </View>
  );

  if (pressable || onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  touchable: {
    borderRadius: 16,
  },
  paddingNone: {
    padding: 0,
  },
  paddingSmall: {
    padding: 16,
  },
  paddingMedium: {
    padding: 20,
  },
  paddingLarge: {
    padding: 24,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
});