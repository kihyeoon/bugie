import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getIoniconName, DEFAULT_CATEGORY_COLOR } from '@/constants/categories';
import type { PaymentMethodEntity } from '@repo/core';

interface PaymentMethodContextMenuProps {
  visible: boolean;
  paymentMethod: PaymentMethodEntity | null;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ icon, text, onPress, danger }: MenuItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon}
        size={22}
        color={danger ? colors.expense : colors.text}
      />
      <Text
        style={[
          styles.menuItemText,
          { color: danger ? colors.expense : colors.text },
        ]}
      >
        {text}
      </Text>
    </TouchableOpacity>
  );
}

export function PaymentMethodContextMenu({
  visible,
  paymentMethod,
  onEdit,
  onDelete,
  onClose,
}: PaymentMethodContextMenuProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible || !paymentMethod) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="auto">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menuContainer}>
          <Pressable
            style={[styles.menu, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* 결제 수단 정보 헤더 */}
            <View style={styles.header}>
              <View
                style={[
                  styles.methodIcon,
                  { backgroundColor: DEFAULT_CATEGORY_COLOR + '20' },
                ]}
              >
                <Ionicons
                  name={getIoniconName(paymentMethod.icon)}
                  size={20}
                  color={DEFAULT_CATEGORY_COLOR}
                />
              </View>
              <Text
                style={[styles.methodName, { color: colors.text }]}
                numberOfLines={1}
              >
                {paymentMethod.name}
              </Text>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {onEdit && (
              <MenuItem icon="create-outline" text="수정" onPress={onEdit} />
            )}

            {onDelete && (
              <MenuItem
                icon="trash-outline"
                text="삭제"
                onPress={onDelete}
                danger
              />
            )}

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <MenuItem icon="close-outline" text="취소" onPress={onClose} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  menu: {
    borderRadius: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  methodIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    flex: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    letterSpacing: -0.3,
  },
});
