import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  BaseBottomSheet,
  type BaseBottomSheetRef,
} from '@/components/ui/BaseBottomSheet';
import { AnimatedCheck } from '@/components/ui/AnimatedCheck';

interface PaidByBottomSheetProps {
  visible: boolean;
  members: Array<{ user_id: string; full_name: string | null }>;
  selectedUserId: string | null;
  currentUserId?: string;
  onSelect: (userId: string) => void;
  onClose: () => void;
}

export function PaidByBottomSheet({
  visible,
  members,
  selectedUserId,
  currentUserId,
  onSelect,
  onClose,
}: PaidByBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const sheetRef = useRef<BaseBottomSheetRef>(null);

  const handleSelect = (userId: string) => {
    onSelect(userId);
    setTimeout(() => sheetRef.current?.close(), 300);
  };

  return (
    <BaseBottomSheet
      ref={sheetRef}
      visible={visible}
      title="지출자 변경"
      onClose={onClose}
      heightRatio={0.4}
    >
      {members.map((member) => {
        const isSelected = member.user_id === selectedUserId;
        const isCurrentUser = member.user_id === currentUserId;

        return (
          <TouchableOpacity
            key={member.user_id}
            style={[
              styles.memberItem,
              {
                backgroundColor: isSelected ? colors.tintLight : 'transparent',
              },
            ]}
            onPress={() => handleSelect(member.user_id)}
            activeOpacity={0.7}
          >
            <View style={styles.memberLeft}>
              <Text
                style={[
                  styles.memberName,
                  {
                    color: colors.text,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {member.full_name || '멤버'}
              </Text>
              {isCurrentUser && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.tint + '15' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: colors.tint }]}>
                    나
                  </Text>
                </View>
              )}
            </View>

            <AnimatedCheck visible={isSelected} color={colors.tint} size={24} />
          </TouchableOpacity>
        );
      })}
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
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
