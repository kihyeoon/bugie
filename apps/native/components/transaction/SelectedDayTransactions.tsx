import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card } from '@/components/ui';
import { formatDayKorean } from '@/utils/dateFormatter';
import { TransactionItem } from './TransactionItem';
import type { TransactionWithDetails } from '@repo/core';

/**
 * 홈에서 한 번에 보여줄 최대 건수.
 * 하루 2~5건이 보통이라 대부분의 날은 여기 닿지 않는다. 더 좁게 자르면
 * 평범한 날에도 잘려서 "목록으로 가야 하는" 마찰이 되살아난다.
 */
const MAX_VISIBLE = 5;

interface SelectedDayTransactionsProps {
  date: Date;
  transactions: TransactionWithDetails[];
  loading: boolean;
  onPressTransaction: (transactionId: string) => void;
  onPressViewAll: () => void;
  style?: ViewStyle;
}

export function SelectedDayTransactions({
  date,
  transactions,
  loading,
  onPressTransaction,
  onPressViewAll,
  style,
}: SelectedDayTransactionsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const visible = transactions.slice(0, MAX_VISIBLE);
  const hiddenCount = transactions.length - visible.length;

  function renderBody() {
    if (loading) {
      return (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={colors.tint} />
        </View>
      );
    }

    if (transactions.length === 0) {
      return (
        <View style={styles.placeholder}>
          <Typography variant="body2" color="secondary">
            거래 내역이 없어요
          </Typography>
        </View>
      );
    }

    return (
      <>
        {visible.map((transaction, index) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            onPress={onPressTransaction}
            showDivider={index < transactions.length - 1}
          />
        ))}
        {hiddenCount > 0 && (
          <Pressable onPress={onPressViewAll} style={styles.more}>
            <Typography
              variant="body2"
              weight="600"
              style={{ color: colors.tint }}
            >
              {`+${hiddenCount}건 더 보기`}
            </Typography>
            <Ionicons name="chevron-forward" size={14} color={colors.tint} />
          </Pressable>
        )}
      </>
    );
  }

  return (
    <Card variant="outlined" padding="none" style={style}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Typography variant="body1" weight="600">
          {formatDayKorean(date)}
        </Typography>
        <Pressable
          onPress={onPressViewAll}
          hitSlop={8}
          style={styles.linkPressable}
        >
          <Typography variant="body2" weight="600" style={{ color: colors.tint }}>
            목록에서 보기
          </Typography>
          <Ionicons name="chevron-forward" size={14} color={colors.tint} />
        </Pressable>
      </View>

      {renderBody()}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  placeholder: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  more: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 13,
  },
});
