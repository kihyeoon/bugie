import { memo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, AmountDisplay } from '@/components/ui';
import { getIoniconName } from '@/constants/categories';
import type { TransactionWithDetails } from '@repo/core';

interface TransactionItemProps {
  transaction: TransactionWithDetails;
  /**
   * id를 인자로 받는다. 호출부가 행마다 새 클로저를 만들면 memo가 매번 깨지므로,
   * 안정적인 핸들러 하나를 넘기고 id는 여기서 붙인다.
   */
  onPress: (transactionId: string) => void;
  /** 마지막 행처럼 구분선이 군더더기가 되는 자리에서 끈다. */
  showDivider?: boolean;
}

export const TransactionItem = memo(function TransactionItem({
  transaction,
  onPress,
  showDivider = true,
}: TransactionItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      style={[
        styles.container,
        { backgroundColor: colors.background },
        showDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={() => onPress(transaction.id)}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: transaction.category_color + '20' },
          ]}
        >
          <Ionicons
            name={getIoniconName(transaction.category_icon, true)}
            size={20}
            color={transaction.category_color}
          />
        </View>
        <View style={styles.info}>
          <Typography variant="body1" weight="500">
            {transaction.title}
          </Typography>
          <Typography variant="caption" color="secondary">
            {transaction.category_name}
          </Typography>
        </View>
      </View>
      <AmountDisplay
        amount={Number(transaction.amount)}
        type={transaction.type}
        size="medium"
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
});
