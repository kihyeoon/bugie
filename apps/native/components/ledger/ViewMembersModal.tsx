import React from 'react';
import { Modal, View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { PermissionService, type LedgerDetail } from '@repo/core';
import type { IconSymbolName } from '@/components/ui/IconSymbol';

interface ViewMembersModalProps {
  visible: boolean;
  ledger: LedgerDetail | null;
  currentUserId: string | undefined;
  onClose: () => void;
}

export function ViewMembersModal({
  visible,
  ledger,
  currentUserId,
  onClose,
}: ViewMembersModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!ledger) {
    return null;
  }

  // 역할별로 멤버 정렬 (owner > admin > member > viewer)
  const sortedMembers = [...ledger.ledger_members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 };
    return roleOrder[a.role] - roleOrder[b.role];
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* 드래그 핸들 */}
        <View style={styles.dragHandle} />

        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft} />
          <Typography variant="h3" weight="600">
            멤버 목록
          </Typography>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* 멤버 리스트 */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.memberCount}>
            <Typography variant="caption" color="secondary">
              총 {sortedMembers.length}명이 이 가계부를 사용하고 있습니다
            </Typography>
          </View>

          {sortedMembers.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            const roleInfo = PermissionService.getRoleUIConfig(member.role);

            return (
              <View
                key={member.user_id}
                style={[
                  styles.memberItem,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                {/* 프로필 사진 영역 */}
                <View
                  style={[styles.avatar, { backgroundColor: colors.border }]}
                >
                  <Typography variant="body1" weight="600" color="secondary">
                    {member.profiles.full_name?.[0] ||
                      member.profiles.email[0].toUpperCase()}
                  </Typography>
                </View>

                {/* 멤버 정보 */}
                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Typography variant="body1" weight="600">
                      {member.profiles.full_name || '이름 없음'}
                    </Typography>
                    {isCurrentUser && (
                      <View
                        style={[
                          styles.meBadge,
                          { backgroundColor: colors.tint },
                        ]}
                      >
                        <Typography
                          variant="caption"
                          weight="600"
                          style={{ color: 'white' }}
                        >
                          나
                        </Typography>
                      </View>
                    )}
                  </View>
                  <Typography variant="caption" color="secondary">
                    {member.profiles.email}
                  </Typography>
                </View>

                {/* 역할 표시 */}
                <View style={styles.roleSection}>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: `${roleInfo.color}15` },
                    ]}
                  >
                    <IconSymbol
                      name={roleInfo.icon as IconSymbolName}
                      size={16}
                      color={roleInfo.color}
                    />
                    <Typography
                      variant="caption"
                      weight="600"
                      style={{ color: roleInfo.color }}
                    >
                      {roleInfo.label}
                    </Typography>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#C7C7CC',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    width: 24,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  memberCount: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  meBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleSection: {
    alignItems: 'flex-end',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
