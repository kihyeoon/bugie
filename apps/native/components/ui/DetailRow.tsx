import { ComponentProps } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from './Typography';
import { IconSymbol } from './IconSymbol';
import {
  getSettingItemColors,
  getSettingItemStyles,
} from '@/utils/settingsColors';

type IconSymbolName = ComponentProps<typeof IconSymbol>['name'];

export interface DetailRowProps {
  // 기본 컨텐츠
  label: string;
  value?: string | number;

  // 상태 및 권한
  editable?: boolean;
  enabled?: boolean;
  actionable?: boolean;

  // 액션
  onPress?: () => void;

  // 스타일 변형
  variant?: 'default' | 'danger' | 'primary' | 'secondary';
  showDivider?: boolean;

  // 상태
  disabled?: boolean;
  loading?: boolean;

  // 커스터마이징
  renderValue?: () => React.ReactNode;
  leftIcon?: IconSymbolName;
  rightIcon?: IconSymbolName | false; // false로 chevron 숨기기
  numberOfLines?: number;
}

export function DetailRow({
  label,
  value,
  editable = false,
  enabled = true,
  actionable = false,
  onPress,
  variant = 'default',
  showDivider = false,
  disabled = false,
  loading = false,
  renderValue,
  leftIcon,
  rightIcon,
  numberOfLines = 1,
}: DetailRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // 실제 액션 가능 여부 결정
  const isActionable = actionable || (editable && !!onPress);

  // 색상 결정
  const itemColors =
    variant === 'danger'
      ? { label: undefined, value: undefined, showChevron: true }
      : variant === 'primary'
        ? {
            label: 'primary' as const,
            value: 'primary' as const,
            showChevron: true,
          }
        : getSettingItemColors({
            isEditable: editable,
            isEnabled: enabled,
            isActionable: isActionable,
            type: variant === 'secondary' ? 'normal' : 'normal',
          });

  // chevron 표시 여부 결정
  const showChevron =
    rightIcon !== false &&
    (rightIcon || (itemColors.showChevron && isActionable));

  // 스타일 계산
  const containerStyle = getSettingItemStyles(
    disabled || loading,
    [
      styles.container,
      showDivider && styles.divider,
      showDivider && { borderBottomColor: colors.border },
    ],
    styles.disabled
  );

  const handlePress = () => {
    if (!disabled && !loading && onPress) {
      onPress();
    }
  };

  const getTextColor = (
    colorType: typeof itemColors.label
  ): 'primary' | 'secondary' | 'disabled' | undefined => {
    if (variant === 'danger') return undefined; // 직접 스타일에서 colors.expense 사용
    if (variant === 'primary') return 'primary';
    return colorType;
  };

  return (
    <Pressable
      style={containerStyle}
      onPress={isActionable ? handlePress : undefined}
      disabled={disabled || loading || !isActionable}
      accessibilityRole={isActionable ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value || ''}`}
    >
      <View style={styles.content}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <IconSymbol
              name={leftIcon}
              size={20}
              color={
                variant === 'danger' ? colors.expense : colors.textSecondary
              }
            />
          </View>
        )}

        <Typography
          variant="body1"
          color={getTextColor(itemColors.label)}
          style={[
            styles.label,
            variant === 'danger' && { color: colors.expense },
          ]}
        >
          {label}
        </Typography>
      </View>

      <View style={styles.valueContainer}>
        {renderValue ? (
          renderValue()
        ) : (
          <Typography
            variant="body1"
            color={getTextColor(itemColors.value)}
            numberOfLines={numberOfLines}
            style={[
              styles.value,
              variant === 'danger' && { color: colors.expense },
            ]}
          >
            {value || ''}
          </Typography>
        )}

        {showChevron && (
          <IconSymbol
            name={rightIcon || 'chevron.right'}
            size={18}
            color={
              variant === 'danger'
                ? colors.expense
                : variant === 'primary'
                  ? colors.tint
                  : colors.textSecondary
            }
            style={styles.chevron}
          />
        )}
      </View>
    </Pressable>
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
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leftIconContainer: {
    marginRight: 12,
    width: 20,
    alignItems: 'center',
  },
  label: {
    flex: 0,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  value: {
    textAlign: 'right',
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
});
