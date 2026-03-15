import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getIoniconName, DEFAULT_CATEGORY_COLOR } from '@/constants/categories';
import { groupPaymentMethods } from '@/hooks/usePaymentMethods';
import {
  BaseBottomSheet,
  type BaseBottomSheetRef,
} from '@/components/ui/BaseBottomSheet';
import { AnimatedCheck } from '@/components/ui/AnimatedCheck';
import { AddPaymentMethodModal } from '@/components/payment-method/AddPaymentMethodModal';
import { EditPaymentMethodModal } from '@/components/payment-method/EditPaymentMethodModal';
import { PaymentMethodContextMenu } from '@/components/payment-method/PaymentMethodContextMenu';
import { useLedger } from '@/contexts/LedgerContext';
import type { PaymentMethodEntity, UpdatePaymentMethodInput } from '@repo/core';

interface PaymentMethodBottomSheetProps {
  visible: boolean;
  paymentMethods: PaymentMethodEntity[];
  selectedId: string | null;
  currentUserId?: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  // CRUD 콜백 — 존재하면 해당 기능 활성화
  onAdd?: (input: {
    name: string;
    icon: string;
    isShared: boolean;
    ownerId?: string | null;
  }) => Promise<void>;
  onUpdate?: (id: string, updates: UpdatePaymentMethodInput) => Promise<void>;
  onDelete?: (id: string) => Promise<boolean>;
}

const SHEET_HEIGHT_RATIO = 0.55;

export function PaymentMethodBottomSheet({
  visible,
  paymentMethods,
  selectedId,
  currentUserId,
  onSelect,
  onClear,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: PaymentMethodBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const sheetRef = useRef<BaseBottomSheetRef>(null);
  const { currentLedger } = useLedger();

  // 관리 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [contextMenuMethod, setContextMenuMethod] =
    useState<PaymentMethodEntity | null>(null);
  const [editTarget, setEditTarget] = useState<PaymentMethodEntity | null>(
    null
  );

  const handleSelect = (id: string) => {
    onSelect(id);
    setTimeout(() => sheetRef.current?.close(), 200);
  };

  const handleClear = () => {
    onClear();
    setTimeout(() => sheetRef.current?.close(), 200);
  };

  // 관리 가능 여부 (역할 권한 기반 — RLS 정책과 일치)
  const canManage = !!(onUpdate || onDelete);

  // 추가 저장
  const handleAddSave = useCallback(
    async (input: { name: string; icon: string; isShared: boolean }) => {
      if (!onAdd) return;
      await onAdd({
        ...input,
        ownerId: input.isShared ? null : undefined,
      });
    },
    [onAdd]
  );

  // 컨텍스트 메뉴 → 수정
  const handleEditFromMenu = useCallback(() => {
    const method = contextMenuMethod;
    setContextMenuMethod(null);
    setTimeout(() => setEditTarget(method), 300);
  }, [contextMenuMethod]);

  // 수정 저장
  const handleSaveEdit = useCallback(
    async (id: string, updates: UpdatePaymentMethodInput) => {
      if (!onUpdate) return;
      await onUpdate(id, updates);
    },
    [onUpdate]
  );

  // 컨텍스트 메뉴 → 삭제
  const handleDeleteFromMenu = useCallback(async () => {
    const method = contextMenuMethod;
    if (!onDelete || !method) return;
    setContextMenuMethod(null);
    await onDelete(method.id);
  }, [onDelete, contextMenuMethod]);

  // EditModal → 삭제
  const handleDeleteFromEdit = useCallback(
    async (id: string) => {
      if (!onDelete) return false;
      return await onDelete(id);
    },
    [onDelete]
  );

  const members = currentLedger?.ledger_members;
  const grouped = groupPaymentMethods(paymentMethods, currentUserId, members);
  const isEmpty = paymentMethods.length === 0;

  const renderItem = (method: PaymentMethodEntity) => {
    const isSelected = method.id === selectedId;
    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.item,
          { backgroundColor: isSelected ? colors.tintLight : 'transparent' },
        ]}
        onPress={() => handleSelect(method.id)}
        onLongPress={
          canManage ? () => setContextMenuMethod(method) : undefined
        }
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View
            style={[
              styles.itemIcon,
              { backgroundColor: DEFAULT_CATEGORY_COLOR + '15' },
            ]}
          >
            <Ionicons
              name={getIoniconName(method.icon)}
              size={18}
              color={DEFAULT_CATEGORY_COLOR}
            />
          </View>
          <Text
            style={[
              styles.itemName,
              { color: colors.text, fontWeight: isSelected ? '600' : '400' },
            ]}
            numberOfLines={1}
          >
            {method.name}
          </Text>
        </View>
        <AnimatedCheck visible={isSelected} color={colors.tint} />
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, items: PaymentMethodEntity[]) => {
    if (items.length === 0) return null;
    return (
      <View key={title}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
          {title}
        </Text>
        {items.map(renderItem)}
      </View>
    );
  };

  return (
    <BaseBottomSheet
      ref={sheetRef}
      visible={visible}
      title="결제 수단"
      onClose={onClose}
      heightRatio={SHEET_HEIGHT_RATIO}
    >
      {isEmpty ? (
        <View style={styles.empty}>
          <Ionicons
            name="card-outline"
            size={40}
            color={colors.textDisabled}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            결제 수단을 등록해보세요
          </Text>
          {onAdd ? (
            <TouchableOpacity
              style={[
                styles.addButtonPrimary,
                { backgroundColor: colors.tint },
              ]}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonPrimaryText}>추가하기</Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={[styles.emptySubtext, { color: colors.textDisabled }]}
            >
              가계부 설정에서 추가할 수 있습니다
            </Text>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 선택 안함 */}
          <TouchableOpacity
            style={[
              styles.item,
              {
                backgroundColor:
                  selectedId === null ? colors.tintLight : 'transparent',
              },
            ]}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.itemIcon,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.itemName,
                  {
                    color: colors.textSecondary,
                    fontWeight: selectedId === null ? '600' : '400',
                  },
                ]}
              >
                선택 안함
              </Text>
            </View>
            <AnimatedCheck
              visible={selectedId === null}
              color={colors.tint}
            />
          </TouchableOpacity>

          {renderSection('공동 수단', grouped.shared)}
          {renderSection('내 수단', grouped.mine)}
          {grouped.othersByOwner.map((group) =>
            renderSection(`${group.ownerName}의 수단`, group.methods)
          )}

          {/* 결제 수단 추가 버튼 */}
          {onAdd && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.tint}
              />
              <Text style={[styles.addButtonText, { color: colors.tint }]}>
                결제 수단 추가
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* 서브 모달 — BaseBottomSheet의 Modal 안에 렌더링 */}
      <AddPaymentMethodModal
        visible={showAddModal}
        onSave={handleAddSave}
        onClose={() => setShowAddModal(false)}
      />
      <PaymentMethodContextMenu
        visible={!!contextMenuMethod}
        paymentMethod={contextMenuMethod}
        onEdit={onUpdate ? handleEditFromMenu : undefined}
        onDelete={onDelete ? handleDeleteFromMenu : undefined}
        onClose={() => setContextMenuMethod(null)}
      />
      <EditPaymentMethodModal
        visible={editTarget !== null}
        paymentMethod={editTarget}
        onSave={handleSaveEdit}
        onDelete={onDelete ? handleDeleteFromEdit : undefined}
        canDelete={!!onDelete}
        onClose={() => setEditTarget(null)}
      />
    </BaseBottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 2,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 15,
    letterSpacing: -0.3,
    flex: 1,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 36,
    paddingTop: 12,
    paddingBottom: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addButtonPrimary: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
