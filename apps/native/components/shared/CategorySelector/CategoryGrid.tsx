import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CategoryItem } from './CategoryItem';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CategoryDetail } from '@repo/core';

interface CategoryGridProps {
  categories: CategoryDetail[];
  selectedCategory: CategoryDetail | null;
  onSelectCategory: (category: CategoryDetail) => void;
  onLongPress?: (category: CategoryDetail) => void;
  transactionType: 'income' | 'expense';
  loading?: boolean;
  columns?: 3 | 4;
}

export function CategoryGrid({
  categories,
  selectedCategory,
  onSelectCategory,
  onLongPress,
  transactionType,
  loading = false,
  columns = 4,
}: CategoryGridProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // 거래 타입에 따라 카테고리 필터링
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => cat.type === transactionType);
  }, [categories, transactionType]);

  // 카테고리를 행으로 그룹화
  const rows = useMemo(() => {
    const result: CategoryDetail[][] = [];
    for (let i = 0; i < filteredCategories.length; i += columns) {
      result.push(filteredCategories.slice(i, i + columns));
    }
    return result;
  }, [filteredCategories, columns]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          카테고리 로딩중...
        </Text>
      </View>
    );
  }

  if (filteredCategories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {transactionType === 'income' ? '수입' : '지출'} 카테고리가 없습니다
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              isSelected={selectedCategory?.id === category.id}
              onPress={() => onSelectCategory(category)}
              onLongPress={onLongPress ? () => onLongPress(category) : undefined}
              columns={columns}
            />
          ))}
          {/* 마지막 행에서 빈 공간 채우기 */}
          {rowIndex === rows.length - 1 &&
            Array.from({ length: columns - row.length }).map((_, index) => (
              <View key={`empty-${index}`} style={{ flex: 1 / columns }} />
            ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    letterSpacing: -0.3,
  },
});
