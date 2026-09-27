import { useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  BaseBottomSheet,
  type BaseBottomSheetRef,
} from '@/components/ui/BaseBottomSheet';
import { AnimatedCheck } from '@/components/ui/AnimatedCheck';
import { memberName } from '@/utils/memberLabels';

// 멤버 상한이 20명이라 스크롤이 필요하다. 결제 수단 시트와 같은 높이.
const SHEET_HEIGHT_RATIO = 0.55;
const CLOSE_DELAY_MS = 300;

export interface SelectableMember {
  user_id: string;
  full_name: string | null;
}

interface MemberSelectSheetProps {
  visible: boolean;
  title: string;
  members: SelectableMember[];
  /** null·undefined면 "전체" 행이 선택된 상태 */
  selectedUserId?: string | null;
  currentUserId?: string;
  onSelect: (userId: string) => void;
  /** 있을 때만 맨 위에 "전체" 행을 그린다 */
  onSelectAll?: () => void;
  onClose: () => void;
}

export function MemberSelectSheet({
  visible,
  title,
  members,
  selectedUserId,
  currentUserId,
  onSelect,
  onSelectAll,
  onClose,
}: MemberSelectSheetProps) {
  const sheetRef = useRef<BaseBottomSheetRef>(null);

  // 체크 애니메이션을 보여준 뒤 닫는다
  const selectAndClose = (select: () => void) => {
    select();
    setTimeout(() => sheetRef.current?.close(), CLOSE_DELAY_MS);
  };

  return (
    <BaseBottomSheet
      ref={sheetRef}
      visible={visible}
      title={title}
      onClose={onClose}
      heightRatio={SHEET_HEIGHT_RATIO}
    >
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {onSelectAll && (
          <MemberRow
            label="전체"
            isSelected={!selectedUserId}
            onPress={() => selectAndClose(onSelectAll)}
          />
        )}
        {members.map((member) => (
          <MemberRow
            key={member.user_id}
            label={memberName(member)}
            isSelected={member.user_id === selectedUserId}
            isCurrentUser={member.user_id === currentUserId}
            onPress={() => selectAndClose(() => onSelect(member.user_id))}
          />
        ))}
      </ScrollView>
    </BaseBottomSheet>
  );
}

function MemberRow({
  label,
  isSelected,
  isCurrentUser = false,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  isCurrentUser?: boolean;
  onPress: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.memberItem,
        { backgroundColor: isSelected ? colors.tintLight : 'transparent' },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.memberLeft}>
        <Text
          style={[
            styles.memberName,
            { color: colors.text, fontWeight: isSelected ? '600' : '400' },
          ]}
        >
          {label}
        </Text>
        {isCurrentUser && (
          <View
            style={[styles.badge, { backgroundColor: colors.tint + '15' }]}
          >
            <Text style={[styles.badgeText, { color: colors.tint }]}>나</Text>
          </View>
        )}
      </View>

      <AnimatedCheck visible={isSelected} color={colors.tint} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberName: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
