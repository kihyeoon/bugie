import { Text, TextProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface AmountDisplayProps extends Omit<TextProps, 'children'> {
  amount: number;
  type?: 'income' | 'expense' | 'neutral';
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

  const formatAmount = (value: number) => {
    return Math.abs(value).toLocaleString('ko-KR');
  };

  const getSign = () => {
    if (!showSign) return '';
    if (type === 'income' || amount > 0) return '+';
    if (type === 'expense' || amount < 0) return '-';
    return '';
  };

  const getColor = () => {
    // type이 명시적으로 지정된 경우 우선 적용
    if (type === 'income') return colors.income;
    if (type === 'expense') return colors.expense;
    
    // type이 neutral인 경우 amount 기준으로 판단
    if (type === 'neutral') {
      if (amount > 0) return colors.income;
      if (amount < 0) return colors.expense;
      return colors.text;
    }
    
    return colors.text;
  };

  const getSizeStyle = () => {
    const sizeStyles = {
      small: styles.small,
      medium: styles.medium,
      large: styles.large,
      xlarge: styles.xlarge,
    };
    return sizeStyles[size];
  };

  const sign = getSign();
  const formattedAmount = formatAmount(amount);
  const displayText = currencyPosition === 'before' 
    ? `${sign}${currency}${formattedAmount}`
    : `${sign}${formattedAmount}${currency}`;

  return (
    <Text
      {...props}
      style={[
        styles.base,
        getSizeStyle(),
        { color: getColor() },
        style,
      ]}
    >
      {displayText}
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