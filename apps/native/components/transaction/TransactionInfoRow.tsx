import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';

interface TransactionInfoRowProps {
  label: string;
  value?: string | null;
  /** value가 비어 있을 때 보조 색으로 보여줄 문구 */
  placeholder?: string;
  /** 값이 있으면 라벨 아래에 전문을 펼쳐 보여준다 (메모용) */
  multiline?: boolean;
  onPress?: () => void;
  /** 권한 없음: 흐리게 표시하고 탭·chevron을 숨긴다 */
  disabled?: boolean;
}

export function TransactionInfoRow({
  label,
  value,
  placeholder,
  multiline = false,
  onPress,
  disabled = false,
}: TransactionInfoRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const hasValue = !!value;
  const pressable = !disabled && !!onPress;
  const stacked = multiline && hasValue;

  const labelNode = (
    <Typography variant="body1" color="secondary" weight="500">
      {label}
    </Typography>
  );
  const chevron = pressable ? (
    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
  ) : null;

  return (
    <Pressable
      style={[styles.row, disabled && styles.disabled]}
      onPress={pressable ? onPress : undefined}
      disabled={!pressable}
    >
      {stacked ? (
        <View style={styles.stackedContent}>
          <View style={styles.stackedHeader}>
            {labelNode}
            {chevron}
          </View>
          <Typography variant="body1">{value}</Typography>
        </View>
      ) : (
        <>
          {labelNode}
          <View style={styles.valueContainer}>
            <Typography
              variant="body1"
              color={hasValue ? 'primary' : 'secondary'}
              numberOfLines={1}
              style={styles.value}
            >
              {hasValue ? value : placeholder}
            </Typography>
            {chevron}
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 56,
    gap: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  valueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  stackedContent: {
    flex: 1,
    gap: 8,
  },
  stackedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
