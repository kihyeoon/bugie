import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { Category } from '@repo/types';

interface CategoryContextMenuProps {
  visible: boolean;
  category: Category | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, text, onPress, danger }) => {
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
};

export default function CategoryContextMenu({
  visible,
  category,
  onEdit,
  onDelete,
  onClose,
}: CategoryContextMenuProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (!visible || !category) return null;

  // 커스텀 카테고리인지 확인 (templateId가 없으면 커스텀)
  const isCustomCategory = !category.template_id;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <View style={[styles.menu, { backgroundColor: colors.background }]}>
            {/* 카테고리 정보 헤더 */}
            <View style={styles.header}>
              <View
                style={[
                  styles.categoryIcon,
                  { backgroundColor: category.color + '20' },
                ]}
              >
                <Ionicons
                  name={category.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={category.color}
                />
              </View>
              <Text style={[styles.categoryName, { color: colors.text }]}>
                {category.name}
              </Text>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* 메뉴 아이템들 */}
            {isCustomCategory && (
              <MenuItem icon="create-outline" text="수정" onPress={onEdit} />
            )}

            <MenuItem
              icon="trash-outline"
              text={isCustomCategory ? '삭제' : '숨기기'}
              onPress={onDelete}
              danger
            />

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <MenuItem icon="close-outline" text="취소" onPress={onClose} />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    paddingHorizontal: 16,
    paddingBottom: 34, // Safe area bottom
  },
  menu: {
    borderRadius: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
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
