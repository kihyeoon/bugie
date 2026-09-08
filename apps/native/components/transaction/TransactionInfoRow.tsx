import { useState } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';

interface TransactionInfoRowProps {
  label: string;
  value?: string | null;
  /** value가 비어 있을 때 보조 색으로 보여줄 문구 */
  placeholder?: string;
  /** 값이 한 줄에 안 들어가면 라벨 아래에 전문을 펼쳐 보여준다 (메모용) */
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
  const [overflows, setOverflows] = useState(false);

  const hasValue = !!value;
  const pressable = !disabled && !!onPress;
  const measure = multiline && hasValue;
  const stacked = measure && overflows;

  const handleMeasure = (e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setOverflows(e.nativeEvent.lines.length > 1);
  };

  return (
    <Pressable
      style={[styles.row, disabled && styles.disabled]}
      onPress={pressable ? onPress : undefined}
      disabled={!pressable}
    >
      <View style={styles.line}>
        <Typography variant="body1" color="secondary" weight="500">
          {label}
        </Typography>
        <View style={styles.valueContainer}>
          <View style={styles.valueSlot}>
            {!stacked && (
              <Typography
                variant="body1"
                color={hasValue ? 'primary' : 'secondary'}
                numberOfLines={1}
                style={styles.value}
              >
                {hasValue ? value : placeholder}
              </Typography>
            )}
            {/* 인라인 자리에 다 들어가는지 재는 용도. 보이지 않는다 */}
            {measure && (
              <Typography
                variant="body1"
                style={[styles.value, styles.measure]}
                onTextLayout={handleMeasure}
                aria-hidden
              >
                {value}
              </Typography>
            )}
          </View>
          {pressable && (
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          )}
        </View>
      </View>
      {stacked && <Typography variant="body1">{value}</Typography>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 56,
    justifyContent: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  valueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  valueSlot: {
    flex: 1,
  },
  value: {
    textAlign: 'right',
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
});
