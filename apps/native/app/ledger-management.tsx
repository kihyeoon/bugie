import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card } from '@/components/ui';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Ionicons } from '@expo/vector-icons';
import { useLedger } from '@/contexts/LedgerContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreateLedgerModal } from '@/components/ledger/CreateLedgerModal';

export default function LedgerManagementScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const {
    ledgers,
    currentLedger,
    loading,
    error,
    refreshLedgers,
    selectLedger,
  } = useLedger();
  const { user } = useAuth();
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    refreshLedgers();
  }, [refreshLedgers]);

  // 화면 포커스 시 가계부 목록 새로고침
  useFocusEffect(
    useCallback(() => {
      refreshLedgers();
    }, [refreshLedgers])
  );

  const handleSelectLedger = async (ledgerId: string) => {
    if (ledgerId === currentLedger?.id) {
      // 이미 선택된 가계부
      return;
    }

    try {
      await selectLedger(ledgerId);
      router.back();
    } catch {
      Alert.alert('오류', '가계부 전환 중 문제가 발생했습니다.');
    }
  };

  const handleCreateLedger = () => {
    setCreateModalVisible(true);
  };

  const handleOpenSettings = (ledger: (typeof ledgers)[0]) => {
    router.push({
      pathname: '/ledger-settings',
      params: {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
      },
    });
  };

  const handleCreateSuccess = async (ledgerId: string) => {
    // 새로 생성된 가계부를 자동으로 선택
    await refreshLedgers();
    await selectLedger(ledgerId);
    router.back();
  };

  const getUserRole = (ledger: (typeof ledgers)[0]) => {
    const member = ledger.ledger_members.find((m) => m.user_id === user?.id);
    if (!member) return null;

    switch (member.role) {
      case 'owner':
        return '소유자';
      case 'admin':
        return '관리자';
      case 'member':
        return '멤버';
      case 'viewer':
        return '열람자';
      default:
        return member.role;
    }
  };

  const getMemberCount = (ledger: (typeof ledgers)[0]) => {
    return ledger.ledger_members.length;
  };

  if (loading && ledgers.length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '가계부 관리',
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
            styles.centerContent,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: '가계부 관리',
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
            styles.centerContent,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <Typography variant="body1" color="secondary">
            가계부를 불러올 수 없습니다.
          </Typography>
          <Pressable onPress={refreshLedgers} style={styles.retryButton}>
            <Typography variant="body1" color="primary">
              다시 시도
            </Typography>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '가계부 관리',
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
          {/* 가계부 목록 */}
          <Card variant="outlined" padding="none" style={styles.ledgerSection}>
            {ledgers.map((ledger, index) => {
              const isSelected = ledger.id === currentLedger?.id;
              const role = getUserRole(ledger);
              const memberCount = getMemberCount(ledger);

              return (
                <View
                  key={ledger.id}
                  style={[
                    styles.ledgerItem,
                    index !== ledgers.length - 1 && styles.ledgerItemBorder,
                    { borderColor: colors.border },
                  ]}
                >
                  {/* 체크 영역 - 가계부 선택 */}
                  <Pressable
                    onPress={() => handleSelectLedger(ledger.id)}
                    style={styles.checkArea}
                  >
                    <IconSymbol
                      name={isSelected ? 'checkmark.circle.fill' : 'circle'}
                      size={20}
                      color={isSelected ? colors.tint : colors.border}
                    />
                  </Pressable>

                  {/* 정보 영역 - 설정 화면으로 이동 */}
                  <Pressable
                    onPress={() => handleOpenSettings(ledger)}
                    style={styles.ledgerContent}
                  >
                    <View style={styles.ledgerInfo}>
                      <Typography
                        variant="body1"
                        weight={isSelected ? '600' : '500'}
                      >
                        {ledger.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="secondary"
                        style={styles.ledgerMeta}
                      >
                        {role} · 멤버 {memberCount}명
                      </Typography>
                    </View>
                    <IconSymbol
                      name="chevron.right"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              );
            })}
          </Card>

          {/* 새 가계부 만들기 버튼 */}
          <Card variant="outlined" padding="none" style={styles.createSection}>
            <Pressable onPress={handleCreateLedger}>
              <View style={styles.createButton}>
                <IconSymbol
                  name="plus.circle.fill"
                  size={24}
                  color={colors.tint}
                  style={styles.createIcon}
                />
                <Typography variant="body1" color="primary">
                  새 가계부 만들기
                </Typography>
              </View>
            </Pressable>
          </Card>

          {/* 안내 메시지 */}
          <View style={styles.infoSection}>
            <Typography
              variant="caption"
              color="secondary"
              style={styles.infoText}
            >
              가계부를 선택하면 해당 가계부의 거래 내역을 확인하고 관리할 수
              있습니다.
            </Typography>
          </View>
        </ScrollView>
      </View>

      {/* 새 가계부 만들기 모달 */}
      <CreateLedgerModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
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
  ledgerSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  ledgerItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkArea: {
    paddingLeft: 20,
    paddingRight: 12,
  },
  ledgerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  ledgerInfo: {
    flex: 1,
  },
  ledgerMeta: {
    marginTop: 4,
  },
  createSection: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  createIcon: {
    marginRight: 8,
  },
  infoSection: {
    marginTop: 24,
    marginHorizontal: 24,
  },
  infoText: {
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
});
