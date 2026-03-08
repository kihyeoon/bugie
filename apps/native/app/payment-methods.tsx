import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { usePaymentMethods, groupPaymentMethods } from '@/hooks/usePaymentMethods';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { PermissionService } from '@repo/core';
import type { PaymentMethodEntity, MemberRole } from '@repo/core';
import { PaymentMethodItem } from '@/components/payment-method/PaymentMethodItem';
import { AddPaymentMethodModal } from '@/components/payment-method/AddPaymentMethodModal';
import { EditPaymentMethodModal } from '@/components/payment-method/EditPaymentMethodModal';

export default function PaymentMethodsScreen() {
  const { ledgerId } = useLocalSearchParams<{ ledgerId: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();
  const { currentLedger } = useLedger();

  const {
    paymentMethods,
    loading,
    create,
    update,
    softDelete,
  } = usePaymentMethods(ledgerId);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentMethodEntity | null>(null);

  // 권한 확인
  const getUserRole = (): MemberRole | null => {
    if (!currentLedger || !user) return null;
    const member = currentLedger.ledger_members.find(
      (m) => m.user_id === user.id
    );
    return member?.role || null;
  };

  const role = getUserRole();
  const canCreate = PermissionService.canDo('createPaymentMethod', role);
  const canEdit = PermissionService.canDo('updatePaymentMethod', role);
  const canDelete = PermissionService.canDo('deletePaymentMethod', role);

  // 그룹핑 데이터
  const grouped = groupPaymentMethods(paymentMethods, user?.id);
  const sections = [
    { title: '공동 수단', data: grouped.shared },
    { title: '내 수단', data: grouped.mine },
    { title: '파트너 수단', data: grouped.others },
  ].filter((s) => s.data.length > 0);

  const handleAddSave = async (input: {
    name: string;
    icon: string;
    isShared: boolean;
  }) => {
    await create({
      name: input.name,
      icon: input.icon,
      isShared: input.isShared,
      ownerId: input.isShared ? null : undefined,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '결제 수단 관리',
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: canCreate
            ? () => (
                <Pressable onPress={() => setAddModalVisible(true)}>
                  <Ionicons name="add" size={28} color={colors.tint} />
                </Pressable>
              )
            : undefined,
        }}
      />

      <View
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : paymentMethods.length === 0 ? (
          <View style={styles.center}>
            <Ionicons
              name="card-outline"
              size={48}
              color={colors.textDisabled}
            />
            <Typography
              variant="body1"
              color="secondary"
              align="center"
              style={{ marginTop: 12 }}
            >
              결제 수단이 없습니다
            </Typography>
            <Typography
              variant="caption"
              color="secondary"
              align="center"
              style={{ marginTop: 4 }}
            >
              카드나 통장을 등록해보세요
            </Typography>
            {canCreate && (
              <Pressable
                style={[styles.addButton, { backgroundColor: colors.tint }]}
                onPress={() => setAddModalVisible(true)}
              >
                <Typography variant="body2" style={{ color: '#fff', fontWeight: '600' }}>
                  추가하기
                </Typography>
              </Pressable>
            )}
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Typography variant="caption" color="secondary" weight="600">
                  {section.title}
                </Typography>
              </View>
            )}
            renderItem={({ item }) => (
              <PaymentMethodItem
                paymentMethod={item}
                isCurrentUser={item.ownerId === user?.id}
                canEdit={canEdit}
                onPress={() => setEditTarget(item)}
                onDelete={() => canDelete && softDelete(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>

      {/* 추가 모달 */}
      <AddPaymentMethodModal
        visible={addModalVisible}
        onSave={handleAddSave}
        onClose={() => setAddModalVisible(false)}
      />

      {/* 수정 모달 */}
      <EditPaymentMethodModal
        visible={editTarget !== null}
        paymentMethod={editTarget}
        onSave={update}
        onClose={() => setEditTarget(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  listContent: {
    paddingBottom: 40,
  },
  addButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
});
