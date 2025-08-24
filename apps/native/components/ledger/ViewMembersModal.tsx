import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { PermissionService, type LedgerDetail } from '@repo/core';

interface ViewMembersModalProps {
  visible: boolean;
  ledger: LedgerDetail | null;
  currentUserId: string | undefined;
  onClose: () => void;
  onRemoveMember?: (userId: string) => Promise<void>;
}

export function ViewMembersModal({
  visible,
  ledger,
  currentUserId,
  onClose,
  onRemoveMember,
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

  // 현재 사용자의 권한 확인
  const currentUserMember = sortedMembers.find(
    (m) => m.user_id === currentUserId
  );
  const currentUserRole = currentUserMember?.role;

  // 멤버 내보내기 핸들러
  const handleRemoveMember = async (member: (typeof sortedMembers)[0]) => {
    if (!onRemoveMember) return;

    const memberName = member.profiles.full_name || member.profiles.email;

    Alert.alert(
      '멤버 내보내기',
      `정말로 ${memberName}님을 가계부에서 내보내시겠습니까?\n내보낸 후에는 해당 멤버가 가계부에 접근할 수 없습니다.`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '내보내기',
          style: 'destructive',
          onPress: async () => {
            try {
              await onRemoveMember(member.user_id);
            } catch {
              Alert.alert('오류', '멤버 내보내기 중 문제가 발생했습니다.');
            }
          },
        },
      ]
    );
  };

  // 통합 액션 시트 표시 함수
  const showActionSheet = async (member: (typeof sortedMembers)[0]) => {
    const memberName = member.profiles.full_name || member.profiles.email;

    // 햅틱 피드백 제공 (롱프레스 인식 시)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'ios') {
      // iOS: 네이티브 ActionSheet 사용
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['프로필 보기', '멤버 내보내기', '취소'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            // 프로필 보기 (향후 구현)
            Alert.alert('준비중', '프로필 보기 기능은 준비중입니다.');
          } else if (buttonIndex === 1) {
            // 멤버 내보내기
            handleRemoveMember(member);
          }
        }
      );
    } else {
      // Android: 네이티브 Alert 사용
      Alert.alert(
        memberName,
        '원하는 작업을 선택하세요',
        [
          {
            text: '프로필 보기',
            onPress: () => {
              Alert.alert('준비중', '프로필 보기 기능은 준비중입니다.');
            },
          },
          {
            text: '멤버 내보내기',
            onPress: () => handleRemoveMember(member),
            style: 'destructive',
          },
          {
            text: '취소',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    }
  };

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

            // 멤버 제거 가능 여부 확인
            const canRemoveMember = PermissionService.canRemoveMember(
              currentUserRole,
              member.role
            );

            return (
              <Pressable
                key={member.user_id}
                onLongPress={() => {
                  // 자기 자신이 아니고 권한이 있을 때만 롱프레스 동작
                  if (canRemoveMember && !isCurrentUser && onRemoveMember) {
                    showActionSheet(member);
                  }
                }}
                delayLongPress={600}
                disabled={!canRemoveMember || isCurrentUser || !onRemoveMember}
                style={({ pressed }) => [
                  styles.memberItem,
                  { backgroundColor: colors.backgroundSecondary },
                  pressed &&
                    canRemoveMember &&
                    !isCurrentUser &&
                    styles.memberItemPressed,
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

                    {/* 권한 뱃지 */}
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor:
                            member.role === 'owner' ? '#FFB80015' : '#10B98115',
                        },
                      ]}
                    >
                      <Typography
                        variant="caption"
                        weight="600"
                        style={{
                          color:
                            member.role === 'owner' ? '#FFB800' : '#10B981',
                        }}
                      >
                        {roleInfo.label}
                      </Typography>
                    </View>
                  </View>
                  <Typography variant="caption" color="secondary">
                    {member.profiles.email}
                  </Typography>
                </View>

                {/* 멤버 관리 버튼 */}
                {canRemoveMember && !isCurrentUser && onRemoveMember && (
                  <Pressable
                    onPress={() => showActionSheet(member)}
                    style={styles.actionButton}
                    hitSlop={8}
                  >
                    <IconSymbol
                      name="ellipsis"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </Pressable>
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
  actionButton: {
    padding: 8,
    borderRadius: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  memberItemPressed: {
    opacity: 0.8,
  },
});
