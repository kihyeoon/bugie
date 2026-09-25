import React, { useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryBottomSheet } from './CategoryBottomSheet';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CategoryDetail } from '@repo/core';
import { getIoniconName } from '@/constants/categories';

interface CategorySelectorProps {
  categories: CategoryDetail[];
  selectedCategory: CategoryDetail | null;
  onSelectCategory: (category: CategoryDetail | null) => void;
  transactionType: 'income' | 'expense';
  loading?: boolean;
  placeholder?: string;
  onCategoriesRefresh?: () => Promise<void>;
  onUpdateCategory: (
    categoryId: string,
    updates: { name: string; color: string; icon: string }
  ) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<boolean>;
}

export function CategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
  transactionType,
  loading = false,
  placeholder = '카테고리 선택',
  onCategoriesRefresh,
  onUpdateCategory,
  onDeleteCategory,
}: CategorySelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  const handleOpenBottomSheet = () => {
    setBottomSheetVisible(true);
  };

  const handleCloseBottomSheet = () => {
    setBottomSheetVisible(false);
  };

  const handleSelectCategory = (category: CategoryDetail) => {
    onSelectCategory(category);
    handleCloseBottomSheet();
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: colors.backgroundSecondary,
          },
        ]}
        onPress={handleOpenBottomSheet}
        activeOpacity={0.7}
      >
        {/* 선택칸은 로딩 중에도 그대로 둔다. 금액을 먼저 입력하므로 누를 때쯤이면 받아져 있고,
            그 전에 누르면 시트 안에서 로딩을 보여준다. */}
        <View style={styles.content}>
          {selectedCategory ? (
            <>
              <Ionicons
                name={getIoniconName(selectedCategory.icon, true)}
                size={20}
                color={selectedCategory.color}
              />
              <Text style={[styles.selectedText, { color: colors.text }]}>
                {selectedCategory.name}
              </Text>
            </>
          ) : (
            <Text
              style={[styles.placeholderText, { color: colors.textSecondary }]}
            >
              {placeholder}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      <CategoryBottomSheet
        visible={bottomSheetVisible}
        onClose={handleCloseBottomSheet}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
        transactionType={transactionType}
        loading={loading}
        onCategoriesRefresh={onCategoriesRefresh}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 52,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  placeholderText: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
});
