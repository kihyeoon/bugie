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
import {
  PermissionService,
  type LedgerDetail,
  type MemberRole,
} from '@repo/core';

interface ViewMembersModalProps {
  visible: boolean;
  ledger: LedgerDetail | null;
  currentUserId: string | undefined;
  onClose: () => void;
  onRemoveMember?: (userId: string) => Promise<void>;
  onTransferOwnership?: (userId: string) => Promise<void>;
}

/**
 * 헬퍼 함수: 멤버 액션 가능 여부 계산
 */
function getMemberActions(
  member: { user_id: string; role: MemberRole },
  currentUserRole: MemberRole | undefined,
  currentUserId: string | undefined,
  callbacks: {
    onRemoveMember?: (userId: string) => Promise<void>;
    onTransferOwnership?: (userId: string) => Promise<void>;
  }
) {
  const isCurrentUser = member.user_id === currentUserId;

  // 순수한 권한 체크
  const canRemoveByPermission = PermissionService.canRemoveMember(
    currentUserRole,
    member.role,
    isCurrentUser
  );

  const canTransferByPermission = PermissionService.canTransferOwnership(
    currentUserRole,
    member.role,
    isCurrentUser
  );

  // UI 콜백과 결합
  const canRemove = canRemoveByPermission && !!callbacks.onRemoveMember;
  const canTransfer =
    canTransferByPermission && !!callbacks.onTransferOwnership;
  const canShowActions = canRemove || canTransfer;

  return {
    canRemove,
    canTransfer,
    canShowActions,
    isCurrentUser,
  };
}

export function ViewMembersModal({
  visible,
  ledger,
  currentUserId,
  onClose,
  onRemoveMember,
  onTransferOwnership,
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

  // 소유자 권한 이전 핸들러
  const handleTransferOwnership = async (member: (typeof sortedMembers)[0]) => {
    if (!onTransferOwnership) return;

    const memberName = member.profiles.full_name || member.profiles.email;

    // 2단계 확인 다이얼로그
    Alert.alert(
      '소유자 권한 이전',
      `${memberName}님에게 소유자 권한을 넘기시겠습니까?\n\n⚠️ 주의사항:\n• 소유자 권한을 넘기면 더 이상 가계부를 관리할 수 없습니다\n• 멤버 초대/제거 권한이 없어집니다\n• 이 작업은 되돌릴 수 없습니다`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '계속',
          style: 'destructive',
          onPress: () => {
            // 2차 확인
            Alert.alert(
              '⚠️ 최종 확인',
              '정말로 확실하신가요? 이 작업은 취소할 수 없습니다.',
              [
                {
                  text: '취소',
                  style: 'cancel',
                },
                {
                  text: '권한 이전',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await onTransferOwnership(member.user_id);
                      Alert.alert(
                        '완료',
                        '소유자 권한이 성공적으로 이전되었습니다.'
                      );
                      onClose();
                    } catch {
                      Alert.alert('오류', '권한 이전 중 문제가 발생했습니다.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // 통합 액션 시트 표시 함수
  const showActionSheet = async (
    member: (typeof sortedMembers)[0],
    actions: ReturnType<typeof getMemberActions>
  ) => {
    const memberName = member.profiles.full_name || member.profiles.email;

    // 햅틱 피드백 제공 (롱프레스 인식 시)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'ios') {
      // iOS: 네이티브 ActionSheet 사용
      const options: string[] = [];
      const destructiveIndices: number[] = [];

      if (actions.canTransfer) {
        options.push('소유자 권한 넘기기');
      }

      if (actions.canRemove) {
        options.push('멤버 내보내기');
        destructiveIndices.push(options.length - 1);
      }

      // 액션이 없으면 표시하지 않음
      if (options.length === 0) {
        return;
      }

      options.push('취소');
      const cancelButtonIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex: destructiveIndices[0],
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (actions.canTransfer && buttonIndex === 0) {
            // 소유자 권한 넘기기
            handleTransferOwnership(member);
          } else if (
            actions.canRemove &&
            buttonIndex === (actions.canTransfer ? 1 : 0)
          ) {
            // 멤버 내보내기
            handleRemoveMember(member);
          }
        }
      );
    } else {
      // Android: 네이티브 Alert 사용
      interface AlertButton {
        text?: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
      }
      const buttons: AlertButton[] = [];

      if (actions.canTransfer) {
        buttons.push({
          text: '소유자 권한 넘기기',
          onPress: () => handleTransferOwnership(member),
        });
      }

      if (actions.canRemove) {
        buttons.push({
          text: '멤버 내보내기',
          onPress: () => handleRemoveMember(member),
          style: 'destructive',
        });
      }

      // 액션이 없으면 표시하지 않음
      if (buttons.length === 0) {
        return;
      }

      buttons.push({
        text: '취소',
        style: 'cancel',
      });

      Alert.alert(memberName, '원하는 작업을 선택하세요', buttons, {
        cancelable: true,
      });
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
            const roleInfo = PermissionService.getRoleUIConfig(member.role);

            // 멤버에 대한 가능한 액션들 확인
            const memberActions = getMemberActions(
              member,
              currentUserRole,
              currentUserId,
              { onRemoveMember, onTransferOwnership }
            );

            return (
              <Pressable
                key={member.user_id}
                onLongPress={() => {
                  // 액션이 가능할 때만 롱프레스 동작
                  if (memberActions.canShowActions) {
                    showActionSheet(member, memberActions);
                  }
                }}
                delayLongPress={600}
                disabled={!memberActions.canShowActions}
                style={({ pressed }) => [
                  styles.memberItem,
                  { backgroundColor: colors.backgroundSecondary },
                  pressed &&
                    memberActions.canShowActions &&
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
                    {memberActions.isCurrentUser && (
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
                {memberActions.canShowActions && (
                  <Pressable
                    onPress={() => showActionSheet(member, memberActions)}
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
