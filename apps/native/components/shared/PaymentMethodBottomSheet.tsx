import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableWithoutFeedback,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getIoniconName } from '@/constants/categories';
import { groupPaymentMethods } from '@/hooks/usePaymentMethods';
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

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.55;
const DRAG_THRESHOLD = 80;

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
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 5,
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
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SHEET_HEIGHT,
        duration: 230,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 230,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setTimeout(handleClose, 200);
  };

  const handleClear = () => {
    onClear();
    setTimeout(handleClose, 200);
  };

  const grouped = groupPaymentMethods(paymentMethods, currentUserId);
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
          <View style={[styles.itemIcon, { backgroundColor: colors.tint + '15' }]}>
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
            <View style={[styles.badge, { backgroundColor: colors.tint + '15' }]}>
              <Text style={[styles.badgeText, { color: colors.tint }]}>공동</Text>
            </View>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={colors.tint} />
        )}
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
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
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

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* 드래그 핸들 */}
          <View {...panResponder.panHandlers} style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.textDisabled }]} />
          </View>

          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>결제 수단</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

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
                  { backgroundColor: selectedId === null ? colors.tintLight : 'transparent' },
                ]}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.itemIcon, { backgroundColor: colors.backgroundSecondary }]}>
                    <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <Text
                    style={[
                      styles.itemName,
                      { color: colors.textSecondary, fontWeight: selectedId === null ? '600' : '400' },
                    ]}
                  >
                    선택 안함
                  </Text>
                </View>
                {selectedId === null && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.tint} />
                )}
              </TouchableOpacity>

              {renderSection('공동 수단', grouped.shared)}
              {renderSection('내 수단', grouped.mine)}
              {renderSection('파트너 수단', grouped.others)}
            </ScrollView>
          )}
        </Animated.View>
      </View>
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
    maxHeight: SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
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
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  list: {
    maxHeight: SHEET_HEIGHT - 120,
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
