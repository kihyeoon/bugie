import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryGrid } from './CategoryGrid';
import { AddCategoryModal } from './AddCategoryModal';
import CategoryContextMenu from './CategoryContextMenu';
import EditCategoryModal from './EditCategoryModal';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useServices } from '@/contexts/ServiceContext';
import { useLedger } from '@/contexts/LedgerContext';
import type { CategoryDetail, CategoryType } from '@repo/core';
import type { Category } from '@repo/types';

interface CategoryBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  categories: CategoryDetail[];
  selectedCategory: CategoryDetail | null;
  onSelectCategory: (category: CategoryDetail) => void;
  transactionType: 'income' | 'expense';
  loading?: boolean;
  onCategoriesRefresh?: () => Promise<void>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const DRAG_THRESHOLD = 100;

export function CategoryBottomSheet({
  visible,
  onClose,
  categories,
  selectedCategory,
  onSelectCategory,
  transactionType,
  loading = false,
  onCategoriesRefresh,
}: CategoryBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { ledgerService } = useServices();
  const { currentLedger } = useLedger();

  const [showAddModal, setShowAddModal] = useState(false);
  const [contextMenuCategory, setContextMenuCategory] = useState<Category | null>(null);
  const [editModalCategory, setEditModalCategory] = useState<Category | null>(null);

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // PanResponder로 드래그 제스처 처리
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DRAG_THRESHOLD) {
          handleClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      // 열기 애니메이션
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]); // translateY와 opacity는 Animated.Value이므로 의존성에서 제외

  const handleClose = () => {
    // 닫기 애니메이션
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleSelectCategory = (category: CategoryDetail) => {
    onSelectCategory(category);
    handleClose();
  };

  const handleAddCategory = async (category: {
    name: string;
    type: CategoryType;
    color: string;
    icon: string;
  }) => {
    if (!currentLedger) {
      Alert.alert('오류', '가계부를 선택해주세요.');
      return;
    }

    try {
      const categoryId = await ledgerService.addCustomCategory(
        currentLedger.id,
        category.name,
        category.type,
        category.color,
        category.icon
      );

      // 카테고리 목록 새로고침
      if (onCategoriesRefresh) {
        await onCategoriesRefresh();
      }

      // 새로 추가된 카테고리 자동 선택
      const newCategory = categories.find((cat) => cat.id === categoryId);
      if (newCategory) {
        onSelectCategory(newCategory);
      }

      Alert.alert('성공', '카테고리가 추가되었습니다.');
    } catch (error) {
      console.error('Failed to add custom category:', error);
      Alert.alert('오류', '카테고리 추가에 실패했습니다.');
    }
  };

  // 카테고리 롱프레스 핸들러
  const handleLongPress = (category: CategoryDetail) => {
    // CategoryDetail을 Category 타입으로 변환
    const categoryForMenu: Category = {
      id: category.id,
      ledger_id: category.ledger_id,
      template_id: category.template_id || undefined,
      name: category.name || '',
      type: category.type,
      color: category.color,
      icon: category.icon,
      sort_order: category.sort_order || 0,
      is_active: category.is_active,
      created_at: category.created_at,
      updated_at: category.updated_at,
      deleted_at: undefined,
    };
    setContextMenuCategory(categoryForMenu);
  };

  // 카테고리 수정 핸들러
  const handleEditCategory = () => {
    if (contextMenuCategory) {
      setEditModalCategory(contextMenuCategory);
      setContextMenuCategory(null);
    }
  };

  // 카테고리 삭제 핸들러
  const handleDeleteCategory = async () => {
    if (!contextMenuCategory) return;
    
    try {
      const { supabase } = await import('@/utils/supabase');
      
      // RPC 함수를 사용하여 soft delete 수행
      // (RLS 정책과 RETURNING 절 이슈를 우회)
      const { error } = await supabase.rpc('soft_delete_category', {
        category_id: contextMenuCategory.id
      });
      
      if (error) throw error;
      
      // 카테고리 목록 새로고침
      if (onCategoriesRefresh) {
        await onCategoriesRefresh();
      }
      
      Alert.alert('성공', '카테고리가 삭제되었습니다.');
      setContextMenuCategory(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
      Alert.alert('오류', '카테고리 삭제에 실패했습니다.');
    }
  };

  // 카테고리 수정 저장 핸들러
  const handleSaveEditCategory = async (
    categoryId: string,
    updates: { name: string; color: string; icon: string }
  ) => {
    try {
      const { supabase } = await import('@/utils/supabase');
      const { error } = await supabase
        .from('categories')
        .update({
          name: updates.name,
          color: updates.color,
          icon: updates.icon,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryId);

      if (error) throw error;
      
      // 카테고리 목록 새로고침
      if (onCategoriesRefresh) {
        await onCategoriesRefresh();
      }
      
      Alert.alert('성공', '카테고리가 수정되었습니다.');
      setEditModalCategory(null);
    } catch (error) {
      console.error('Failed to update category:', error);
      Alert.alert('오류', '카테고리 수정에 실패했습니다.');
      throw error;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* 배경 딤 처리 */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: opacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              height: SHEET_HEIGHT + insets.bottom,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* 드래그 핸들 */}
          <View {...panResponder.panHandlers} style={styles.handle}>
            <View
              style={[
                styles.handleBar,
                { backgroundColor: colors.textDisabled },
              ]}
            />
          </View>

          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              카테고리 선택
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* 카테고리 그리드 */}
          <CategoryGrid
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            onLongPress={handleLongPress}
            transactionType={transactionType}
            loading={loading}
            columns={4}
          />

          {/* 커스텀 카테고리 추가 버튼 */}
          <TouchableOpacity
            style={[
              styles.addButton,
              {
                backgroundColor: colors.backgroundSecondary,
                marginBottom: insets.bottom + 24,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.tint} />
            <Text style={[styles.addButtonText, { color: colors.tint }]}>
              커스텀 카테고리 추가
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* 커스텀 카테고리 추가 모달 */}
      <AddCategoryModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddCategory}
        initialType={transactionType}
      />

      {/* 카테고리 컨텍스트 메뉴 */}
      <CategoryContextMenu
        visible={!!contextMenuCategory}
        category={contextMenuCategory}
        onEdit={handleEditCategory}
        onDelete={handleDeleteCategory}
        onClose={() => setContextMenuCategory(null)}
      />

      {/* 카테고리 수정 모달 */}
      <EditCategoryModal
        visible={!!editModalCategory}
        category={editModalCategory}
        onSave={handleSaveEditCategory}
        onClose={() => setEditModalCategory(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
