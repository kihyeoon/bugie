import { Text, TextProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  formatAmount,
  type TransactionType,
  type FormatType,
} from '@/utils/currency';

interface AmountDisplayProps extends Omit<TextProps, 'children'> {
  amount: number;
  type?: TransactionType;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showSign?: boolean;
  currency?: string;
  currencyPosition?: 'before' | 'after';
}

export function AmountDisplay({
  amount,
  type = 'neutral',
  size = 'medium',
  showSign = true,
  currency = '원',
  currencyPosition = 'after',
  style,
  ...props
}: AmountDisplayProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // size에 따른 포맷 결정 (small은 축약형, 나머지는 full)
  const format: FormatType = size === 'small' ? 'abbreviated' : 'full';

  // 통화 표시 결정 (currency가 '원'이 아니거나 currencyPosition이 'before'인 경우만)
  const showCurrency = currency !== '원' || currencyPosition === 'before';

  // 핵심 포맷팅 로직 호출
  const result = formatAmount({
    amount,
    type,
    format,
    showSign,
    showCurrency,
    currency,
  });

  // 색상 매핑
  const getColor = () => {
    switch (result.colorKey) {
      case 'income':
        return colors.income;
      case 'expense':
        return colors.expense;
      case 'neutral':
        // neutral의 경우 amount 기준으로 판단
        if (amount > 0) return colors.income;
        if (amount < 0) return colors.expense;
        return colors.text;
      default:
        return colors.text;
    }
  };

  // 크기별 스타일
  const getSizeStyle = () => {
    const sizeStyles = {
      small: styles.small,
      medium: styles.medium,
      large: styles.large,
      xlarge: styles.xlarge,
    };
    return sizeStyles[size];
  };

  // currencyPosition이 'after'이고 showCurrency가 false인 경우 수동으로 '원' 추가
  const finalText =
    !showCurrency && currencyPosition === 'after'
      ? `${result.formatted}${currency}`
      : result.formatted;

  return (
    <Text
      {...props}
      style={[styles.base, getSizeStyle(), { color: getColor() }, style]}
    >
      {finalText}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  small: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  medium: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  large: {
    fontSize: 24,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  xlarge: {
    fontSize: 48,
    letterSpacing: -1,
    fontWeight: '700',
  },
});
