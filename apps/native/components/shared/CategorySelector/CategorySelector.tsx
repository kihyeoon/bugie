import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategoryBottomSheet } from './CategoryBottomSheet';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CategoryDetail } from '@repo/core';

interface CategorySelectorProps {
  categories: CategoryDetail[];
  selectedCategory: CategoryDetail | null;
  onSelectCategory: (category: CategoryDetail | null) => void;
  transactionType: 'income' | 'expense';
  loading?: boolean;
  placeholder?: string;
}

export function CategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
  transactionType,
  loading = false,
  placeholder = '카테고리 선택',
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

  // 카테고리 아이콘 매핑 (간단한 예시)
  const getIconName = (icon?: string): keyof typeof Ionicons.glyphMap => {
    if (!icon) return 'pricetag-outline';

    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      utensils: 'restaurant-outline',
      car: 'car-outline',
      'shopping-bag': 'cart-outline',
      film: 'film-outline',
      heart: 'heart-outline',
      home: 'home-outline',
      book: 'book-outline',
      'more-horizontal': 'ellipsis-horizontal',
      briefcase: 'briefcase-outline',
      'trending-up': 'trending-up-outline',
      'bar-chart': 'bar-chart-outline',
      gift: 'gift-outline',
      'plus-circle': 'add-circle-outline',
      tag: 'pricetag-outline',
      receipt: 'receipt-outline',
    };
    return iconMap[icon] || 'pricetag-outline';
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
        disabled={loading}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : selectedCategory ? (
            <>
              <Ionicons
                name={getIconName(selectedCategory.icon)}
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
    paddingVertical: 14,
    borderRadius: 12,
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
