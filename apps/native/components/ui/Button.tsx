import {
  TouchableOpacity,
  Text,
  StyleSheet,
  TouchableOpacityProps,
  ActivityIndicator,
  View,
} from 'react-native';
import { ComponentProps } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

type IconSymbolName = ComponentProps<typeof IconSymbol>['name'];

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
  loading?: boolean;
  icon?: IconSymbolName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  children,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getButtonStyle = () => {
    const baseStyle = {
      ...styles.base,
      ...(fullWidth && styles.fullWidth),
    };

    const sizeStyles = {
      small: styles.small,
      medium: styles.medium,
      large: styles.large,
    };

    const variantStyles = {
      primary: {
        backgroundColor: disabled ? colors.textDisabled : colors.tint,
      },
      secondary: {
        backgroundColor: disabled ? colors.backgroundSecondary : colors.backgroundSecondary,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      danger: {
        backgroundColor: disabled ? colors.textDisabled : colors.expense,
      },
    };

    return [baseStyle, sizeStyles[size], variantStyles[variant], style];
  };

  const getTextStyle = () => {
    const sizeStyles = {
      small: styles.textSmall,
      medium: styles.textMedium,
      large: styles.textLarge,
    };

    const variantStyles = {
      primary: {
        color: 'white',
      },
      secondary: {
        color: disabled ? colors.textDisabled : colors.text,
      },
      ghost: {
        color: disabled ? colors.textDisabled : colors.tint,
      },
      danger: {
        color: 'white',
      },
    };

    return [styles.text, sizeStyles[size], variantStyles[variant]];
  };

  const iconColor = variant === 'primary' || variant === 'danger' ? 'white' : 
                    disabled ? colors.textDisabled : colors.text;

  const iconSize = size === 'small' ? 16 : size === 'medium' ? 18 : 20;

  return (
    <TouchableOpacity
      {...props}
      style={getButtonStyle()}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'primary' || variant === 'danger' ? 'white' : colors.text} 
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <IconSymbol name={icon} size={iconSize} color={iconColor} />
          )}
          <Text style={getTextStyle()}>{children}</Text>
          {icon && iconPosition === 'right' && (
            <IconSymbol name={icon} size={iconSize} color={iconColor} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  medium: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  textSmall: {
    fontSize: 14,
  },
  textMedium: {
    fontSize: 16,
  },
  textLarge: {
    fontSize: 18,
  },
});