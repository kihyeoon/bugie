import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Alert, Pressable } from 'react-native';
import {
  router,
  Stack,
  useLocalSearchParams,
  useFocusEffect,
} from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, DetailRow, DetailSection } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '@/contexts/LedgerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { EditTextModal } from '@/components/shared/EditTextModal';
import { ViewMembersModal } from '@/components/ledger/ViewMembersModal';
import { InviteMemberModal } from '@/components/ledger/InviteMemberModal';
import type { LedgerWithMembers, LedgerDetail, MemberRole } from '@repo/core';
import { PermissionService } from '@repo/core';

export default function LedgerSettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<{
    ledgerId: string;
    ledgerName: string;
  }>();
  const { ledgers, refreshLedgers } = useLedger();
  const { user } = useAuth();
  const { ledgerService } = useServices();

  const [ledger, setLedger] = useState<LedgerWithMembers | null>(null);
  const [ledgerDetail, setLedgerDetail] = useState<LedgerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [descriptionModalVisible, setDescriptionModalVisible] = useState(false);
  const [viewMembersModalVisible, setViewMembersModalVisible] = useState(false);
  const [inviteMemberModalVisible, setInviteMemberModalVisible] =
    useState(false);

  useEffect(() => {
    // URL 파라미터로 받은 ledgerId로 가계부 찾기
    const currentLedger = ledgers.find((l) => l.id === params.ledgerId);
    if (currentLedger) {
      setLedger(currentLedger);
    }
  }, [ledgers, params.ledgerId]);

  // 멤버 상세 정보 가져오기
  const fetchLedgerDetail = useCallback(async () => {
    if (!params.ledgerId) return;

    try {
      const detail = await ledgerService.getLedgerDetail(params.ledgerId);
      if (detail) {
        setLedgerDetail(detail);
      }
    } catch (error) {
      console.error('Failed to fetch ledger detail:', error);
    }
  }, [params.ledgerId, ledgerService]);

  // 화면 포커스 시 가계부 기본 정보와 멤버 정보 모두 갱신
  useFocusEffect(
    useCallback(() => {
      // 가계부 목록 새로고침 (기본 정보 갱신)
      refreshLedgers();
      // 멤버 상세 정보 갱신
      fetchLedgerDetail();
    }, [refreshLedgers, fetchLedgerDetail])
  );

  const getUserRole = () => {
    if (!ledger || !user) return null;
    const member = ledger.ledger_members.find((m) => m.user_id === user.id);
    return member?.role;
  };

  const getMemberCount = () => {
    if (!ledger) return 0;
    return ledger.ledger_members.length;
  };

  const handleEditName = () => {
    setNameModalVisible(true);
  };

  const handleEditDescription = () => {
    setDescriptionModalVisible(true);
  };

  const handleSaveName = async (name: string) => {
    if (!ledger || !name.trim()) return;

    setLoading(true);
    try {
      await ledgerService.updateLedger({
        ledgerId: ledger.id,
        name: name.trim(),
      });
      // 가계부 목록 새로고침 후 현재 가계부 정보 즉시 업데이트
      await refreshLedgers();
    } catch {
      Alert.alert('오류', '가계부 이름 수정 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDescription = async (description: string) => {
    if (!ledger) return;

    setLoading(true);
    try {
      await ledgerService.updateLedger({
        ledgerId: ledger.id,
        description: description.trim() || undefined,
      });
      // 가계부 목록 새로고침 후 현재 가계부 정보 즉시 업데이트
      await refreshLedgers();
    } catch {
      Alert.alert('오류', '가계부 설명 수정 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMembers = async () => {
    if (!ledgerDetail) {
      // 멤버 정보가 없으면 먼저 가져오기
      await fetchLedgerDetail();
    }
    setViewMembersModalVisible(true);
  };

  const handleInviteMember = () => {
    setInviteMemberModalVisible(true);
  };

  const handleInviteMemberSubmit = async (email: string, role: MemberRole) => {
    if (!ledger) return;

    await ledgerService.inviteMember({
      ledgerId: ledger.id,
      userEmail: email,
      role,
    });

    // 멤버 목록 새로고침
    await fetchLedgerDetail();
    await refreshLedgers();
  };

  const handleRemoveMember = async (userId: string) => {
    if (!ledger) return;

    setLoading(true);
    try {
      await ledgerService.removeMember(ledger.id, userId);
      // 멤버 목록 새로고침
      await fetchLedgerDetail();
      await refreshLedgers();
    } catch (error) {
      console.error('Failed to remove member:', error);
      Alert.alert('오류', '멤버 내보내기 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLedger = () => {
    Alert.alert(
      '가계부 삭제',
      '정말로 이 가계부를 삭제하시겠습니까?\n모든 거래 내역이 영구적으로 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            if (!ledger) return;

            setLoading(true);
            try {
              await ledgerService.deleteLedger(ledger.id);
              await refreshLedgers();
              router.back();
              router.back(); // 가계부 관리 화면도 닫기
            } catch {
              Alert.alert('오류', '가계부 삭제 중 문제가 발생했습니다.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveLedger = () => {
    Alert.alert('가계부 나가기', '정말로 이 가계부에서 나가시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          if (!ledger) return;

          setLoading(true);
          try {
            await ledgerService.leaveLedger(ledger.id);
            await refreshLedgers();
            router.back();
            router.back(); // 가계부 관리 화면도 닫기
          } catch (error) {
            console.error('Failed to leave ledger:', error);
            Alert.alert('오류', '가계부 나가기 중 문제가 발생했습니다.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const role = getUserRole();
  const memberCount = getMemberCount();
  const canManageMembers = PermissionService.canDo('inviteMember', role);
  const canEditLedger = PermissionService.canDo('updateLedger', role);
  const canDeleteLedger = PermissionService.canDo('deleteLedger', role);

  if (!ledger) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '가계부 설정',
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
            ),
          }}
        />
        <View
          style={[
            styles.container,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <View style={styles.centerContent}>
            <Typography variant="body1" color="secondary">
              가계부를 불러오는 중...
            </Typography>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: ledger.name,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <View
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 가계부 정보 섹션 */}
          <DetailSection title="가계부 정보">
            <DetailRow
              label="이름"
              value={ledger.name}
              editable={canEditLedger}
              actionable={canEditLedger}
              onPress={canEditLedger ? handleEditName : undefined}
              disabled={loading || !canEditLedger}
            />
            <DetailRow
              label="설명"
              value={ledger.description || '설명 없음'}
              editable={canEditLedger}
              actionable={canEditLedger}
              onPress={canEditLedger ? handleEditDescription : undefined}
              disabled={loading || !canEditLedger}
              numberOfLines={1}
            />
            <DetailRow
              label="통화"
              value="KRW (한국 원화)"
              editable={false}
              enabled={false}
              rightIcon={false}
            />
          </DetailSection>

          {/* 멤버 관리 섹션 */}
          <DetailSection title="멤버 관리">
            <DetailRow
              label="멤버 보기"
              value={`${memberCount}명`}
              editable={true}
              actionable={true}
              onPress={handleViewMembers}
              disabled={loading}
              showDivider={canManageMembers}
            />
            {canManageMembers && (
              <DetailRow
                label="멤버 초대"
                editable={true}
                actionable={true}
                onPress={handleInviteMember}
                disabled={loading}
              />
            )}
          </DetailSection>

          {/* 위험 구역 섹션 */}
          <DetailSection title="위험 구역">
            {canDeleteLedger ? (
              <DetailRow
                label="가계부 삭제"
                variant="danger"
                actionable={true}
                onPress={handleDeleteLedger}
                disabled={loading}
              />
            ) : (
              <DetailRow
                label="가계부 나가기"
                variant="danger"
                actionable={true}
                onPress={handleLeaveLedger}
                disabled={loading}
              />
            )}
          </DetailSection>

          {/* 정보 메시지 */}
          <View style={styles.infoSection}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.infoText}
            >
              {PermissionService.getRoleDescription(role)}
            </Typography>
          </View>
        </ScrollView>
      </View>

      {/* 이름 수정 모달 */}
      {ledger && (
        <EditTextModal
          visible={nameModalVisible}
          title="가계부 이름"
          initialValue={ledger.name}
          placeholder="예: 우리집 가계부"
          maxLength={50}
          onSave={handleSaveName}
          onClose={() => setNameModalVisible(false)}
        />
      )}

      {/* 설명 수정 모달 */}
      {ledger && (
        <EditTextModal
          visible={descriptionModalVisible}
          title="가계부 설명"
          initialValue={ledger.description || ''}
          placeholder="가계부에 대한 간단한 설명을 입력하세요"
          maxLength={200}
          multiline
          onSave={handleSaveDescription}
          onClose={() => setDescriptionModalVisible(false)}
        />
      )}

      {/* 멤버 목록 모달 */}
      <ViewMembersModal
        visible={viewMembersModalVisible}
        ledger={ledgerDetail}
        currentUserId={user?.id}
        onClose={() => setViewMembersModalVisible(false)}
        onRemoveMember={handleRemoveMember}
      />

      {/* 멤버 초대 모달 */}
      {ledger && (
        <InviteMemberModal
          visible={inviteMemberModalVisible}
          ledgerId={ledger.id}
          onInvite={handleInviteMemberSubmit}
          onClose={() => setInviteMemberModalVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  infoSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  infoText: {
    lineHeight: 18,
  },
});
