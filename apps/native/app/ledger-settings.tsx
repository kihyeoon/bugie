import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, Pressable } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card } from '@/components/ui';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '@/contexts/LedgerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { EditTextModal } from '@/components/transaction/EditTextModal';
import type { LedgerWithMembers } from '@repo/core';

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
  const [loading, setLoading] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [descriptionModalVisible, setDescriptionModalVisible] = useState(false);

  useEffect(() => {
    // URL 파라미터로 받은 ledgerId로 가계부 찾기
    const currentLedger = ledgers.find((l) => l.id === params.ledgerId);
    if (currentLedger) {
      setLedger(currentLedger);
    }
  }, [ledgers, params.ledgerId]);

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

  const handleChangeCurrency = () => {
    Alert.alert('준비 중', '통화 변경 기능은 곧 추가될 예정입니다.');
  };

  const handleSaveName = async (name: string) => {
    if (!ledger || !name.trim()) return;

    setLoading(true);
    try {
      await ledgerService.updateLedger({
        ledgerId: ledger.id,
        name: name.trim(),
      });
      await refreshLedgers();
      const updatedLedger = ledgers.find((l) => l.id === params.ledgerId);
      if (updatedLedger) {
        setLedger(updatedLedger);
      }
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
      await refreshLedgers();
      const updatedLedger = ledgers.find((l) => l.id === params.ledgerId);
      if (updatedLedger) {
        setLedger(updatedLedger);
      }
    } catch {
      Alert.alert('오류', '가계부 설명 수정 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewMembers = () => {
    Alert.alert('준비 중', '멤버 목록 기능은 곧 추가될 예정입니다.');
  };

  const handleInviteMember = () => {
    Alert.alert('준비 중', '멤버 초대 기능은 곧 추가될 예정입니다.');
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
          } catch {
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
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const canManageMembers = isOwner || isAdmin;

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
          <View style={styles.section}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.sectionTitle}
            >
              가계부 정보
            </Typography>
            <Card
              variant="outlined"
              padding="none"
              style={styles.cardContainer}
            >
              <Pressable
                onPress={handleEditName}
                style={[
                  styles.settingItem,
                  styles.settingItemBorder,
                  { borderColor: colors.border },
                ]}
                disabled={loading}
              >
                <Typography variant="body1">이름</Typography>
                <View style={styles.settingValue}>
                  <Typography variant="body1" color="secondary">
                    {ledger.name}
                  </Typography>
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={handleEditDescription}
                style={[
                  styles.settingItem,
                  styles.settingItemBorder,
                  { borderColor: colors.border },
                ]}
                disabled={loading}
              >
                <Typography variant="body1">설명</Typography>
                <View style={styles.settingValue}>
                  <Typography
                    variant="body1"
                    color="secondary"
                    numberOfLines={1}
                    style={styles.descriptionText}
                  >
                    {ledger.description || '설명 없음'}
                  </Typography>
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={handleChangeCurrency}
                style={[styles.settingItem, styles.disabledItem]}
                disabled={true}
              >
                <Typography variant="body1" color="secondary">
                  통화
                </Typography>
                <View style={styles.settingValue}>
                  <Typography variant="body1" color="disabled">
                    KRW (한국 원화)
                  </Typography>
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={colors.textDisabled}
                  />
                </View>
              </Pressable>
            </Card>
          </View>

          {/* 멤버 관리 섹션 */}
          <View style={styles.section}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.sectionTitle}
            >
              멤버 관리
            </Typography>
            <Card
              variant="outlined"
              padding="none"
              style={styles.cardContainer}
            >
              <Pressable
                onPress={handleViewMembers}
                style={[
                  styles.settingItem,
                  canManageMembers && styles.settingItemBorder,
                  { borderColor: colors.border },
                ]}
                disabled={loading}
              >
                <Typography variant="body1">멤버 보기</Typography>
                <View style={styles.settingValue}>
                  <Typography variant="body1" color="secondary">
                    {memberCount}명
                  </Typography>
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={colors.textSecondary}
                  />
                </View>
              </Pressable>

              {canManageMembers && (
                <Pressable
                  onPress={handleInviteMember}
                  style={styles.settingItem}
                  disabled={loading}
                >
                  <Typography variant="body1" color="primary">
                    멤버 초대
                  </Typography>
                  <IconSymbol
                    name="chevron.right"
                    size={20}
                    color={colors.tint}
                  />
                </Pressable>
              )}
            </Card>
          </View>

          {/* 위험 구역 섹션 */}
          <View style={styles.section}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.sectionTitle}
            >
              위험 구역
            </Typography>
            <Card
              variant="outlined"
              padding="none"
              style={styles.cardContainer}
            >
              {isOwner ? (
                <Pressable
                  onPress={handleDeleteLedger}
                  style={styles.settingItem}
                  disabled={loading}
                >
                  <Typography variant="body1" style={styles.dangerText}>
                    가계부 삭제
                  </Typography>
                  <IconSymbol name="chevron.right" size={20} color="#FF3B30" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleLeaveLedger}
                  style={styles.settingItem}
                  disabled={loading}
                >
                  <Typography variant="body1" style={styles.dangerText}>
                    가계부 나가기
                  </Typography>
                  <IconSymbol name="chevron.right" size={20} color="#FF3B30" />
                </Pressable>
              )}
            </Card>
          </View>

          {/* 정보 메시지 */}
          <View style={styles.infoSection}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.infoText}
            >
              {isOwner
                ? '소유자로서 모든 설정을 변경할 수 있습니다.'
                : isAdmin
                  ? '관리자로서 멤버를 초대하고 가계부 정보를 수정할 수 있습니다.'
                  : '멤버로서 거래를 입력하고 조회할 수 있습니다.'}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disabledItem: {
    opacity: 0.6,
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
  section: {
    marginBottom: 24,
  },
  cardContainer: {
    marginHorizontal: 16,
  },
  sectionTitle: {
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  descriptionText: {
    maxWidth: 200,
  },
  dangerText: {
    color: '#FF3B30',
  },
  infoSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  infoText: {
    lineHeight: 18,
  },
});
