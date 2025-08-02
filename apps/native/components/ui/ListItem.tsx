import {
  View,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
} from 'react-native';
import { ComponentProps } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

type IconSymbolName = ComponentProps<typeof IconSymbol>['name'];

interface ListItemProps extends TouchableOpacityProps {
  title: string;
  subtitle?: string;
  leftIcon?: IconSymbolName;
  rightIcon?: IconSymbolName;
  rightText?: string;
  onPress?: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  rightIcon = 'chevron.right',
  rightText,
  onPress,
  variant = 'default',
  disabled = false,
  style,
  ...props
}: ListItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getTextColor = () => {
    if (disabled) return colors.textDisabled;
    if (variant === 'danger') return colors.expense;
    return colors.text;
  };

  const getSubtitleColor = () => {
    if (disabled) return colors.textDisabled;
    return colors.textSecondary;
  };

  return (
    <TouchableOpacity
      {...props}
      style={[styles.container, style]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <IconSymbol
              name={leftIcon}
              size={24}
              color={getTextColor()}
            />
          </View>
        )}
        
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: getTextColor() }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: getSubtitleColor() }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightContainer}>
        {rightText && (
          <Text style={[styles.rightText, { color: colors.textSecondary }]}>
            {rightText}
          </Text>
        )}
        {rightIcon && onPress && (
          <IconSymbol
            name={rightIcon}
            size={18}
            color={colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIconContainer: {
    marginRight: 16,
    width: 24,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightText: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
});