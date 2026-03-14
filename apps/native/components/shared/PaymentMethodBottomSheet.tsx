import React, { useRef } from 'react';
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
import { getIoniconName } from '@/constants/categories';
import { groupPaymentMethods } from '@/hooks/usePaymentMethods';
import {
  BaseBottomSheet,
  type BaseBottomSheetRef,
} from '@/components/ui/BaseBottomSheet';
import { AnimatedCheck } from '@/components/ui/AnimatedCheck';
import { useLedger } from '@/contexts/LedgerContext';
import type { PaymentMethodEntity } from '@repo/core';

interface PaymentMethodBottomSheetProps {
  visible: boolean;
  paymentMethods: PaymentMethodEntity[];
  selectedId: string | null;
  currentUserId?: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
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
}: PaymentMethodBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const sheetRef = useRef<BaseBottomSheetRef>(null);
  const { currentLedger } = useLedger();

  const handleSelect = (id: string) => {
    onSelect(id);
    setTimeout(() => sheetRef.current?.close(), 200);
  };

  const handleClear = () => {
    onClear();
    setTimeout(() => sheetRef.current?.close(), 200);
  };

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
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View
            style={[styles.itemIcon, { backgroundColor: colors.tint + '15' }]}
          >
            <Ionicons
              name={getIoniconName(method.icon)}
              size={18}
              color={colors.tint}
            />
          </View>
          <Text
            style={[
              styles.itemName,
              { color: colors.text, fontWeight: isSelected ? '600' : '400' },
            ]}
          >
            {method.name}
          </Text>
          {method.isShared && (
            <View
              style={[styles.badge, { backgroundColor: colors.tint + '15' }]}
            >
              <Text style={[styles.badgeText, { color: colors.tint }]}>
                공동
              </Text>
            </View>
          )}
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
          <Ionicons name="card-outline" size={40} color={colors.textDisabled} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            결제 수단을 등록해보세요
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textDisabled }]}>
            가계부 설정에서 추가할 수 있습니다
          </Text>
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
            <AnimatedCheck visible={selectedId === null} color={colors.tint} />
          </TouchableOpacity>

          {renderSection('공동 수단', grouped.shared)}
          {renderSection('내 수단', grouped.mine)}
          {grouped.othersByOwner.map((group) =>
            renderSection(`${group.ownerName}의 수단`, group.methods)
          )}
        </ScrollView>
      )}
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
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
});
