import { useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui';
import { MemberSelectSheet } from '@/components/shared/MemberSelectSheet';

interface Member {
  user_id: string;
  full_name: string | null;
}

interface MemberFilterProps {
  members: Member[];
  currentUserId?: string;
  /** null이면 전체 */
  selectedMemberId: string | null;
  onChange: (memberId: string | null) => void;
}

const TITLE = '멤버별로 보기';

/**
 * 거래 목록 멤버 필터 — 누르면 시트가 열리는 드롭다운 알약.
 * 필터가 캘린더 합계까지 바꾸므로 지금 누구를 보는지 항상 이름으로 보여준다.
 */
export function MemberFilter({
  members,
  currentUserId,
  selectedMemberId,
  onChange,
}: MemberFilterProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [sheetVisible, setSheetVisible] = useState(false);

  // 나를 맨 앞에. 나머지는 받은 순서 그대로
  const sortedMembers = useMemo(
    () => [
      ...members.filter((m) => m.user_id === currentUserId),
      ...members.filter((m) => m.user_id !== currentUserId),
    ],
    [members, currentUserId]
  );

  const selected = members.find((m) => m.user_id === selectedMemberId);
  const label = selected ? selected.full_name || '멤버' : '전체';
  const isActive = selected !== undefined;

  return (
    <>
      <Pressable
        onPress={() => setSheetVisible(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${TITLE}, 현재 ${label}`}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: isActive
              ? colors.tintLight
              : colors.backgroundSecondary,
          },
          pressed && styles.pressed,
        ]}
      >
        <Typography
          variant="body2"
          weight={isActive ? '600' : '500'}
          numberOfLines={1}
          style={styles.label}
        >
          {label}
        </Typography>
        <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
      </Pressable>

      <MemberSelectSheet
        visible={sheetVisible}
        title={TITLE}
        members={sortedMembers}
        selectedUserId={selectedMemberId}
        currentUserId={currentUserId}
        onSelect={onChange}
        onSelectAll={() => onChange(null)}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    maxWidth: 160,
  },
});
