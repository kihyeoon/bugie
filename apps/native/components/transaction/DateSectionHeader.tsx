import { StyleSheet, View } from 'react-native';
import { Typography } from '@/components/ui';
import { formatDateKorean, formatDayKorean } from '@/utils/dateFormatter';

interface DateSectionHeaderProps {
  /** YYYY-MM-DD */
  date: string;
  /** 여러 해에 걸친 목록(검색)에서 올해가 아닌 날짜에 연도를 붙인다 */
  withYear?: boolean;
}

/** 거래 목록의 날짜 섹션 헤더. 배경이 없으니 SectionList의 sticky 헤더는 끈 채로 쓴다. */
export function DateSectionHeader({
  date,
  withYear = false,
}: DateSectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Typography variant="body2" weight="500" color="secondary">
        {withYear ? formatDateKorean(date) : formatDayKorean(date)}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 16,
  },
});
