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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface PaidByBottomSheetProps {
  visible: boolean;
  members: Array<{ user_id: string; full_name: string | null }>;
  selectedUserId: string | null;
  currentUserId?: string;
  onSelect: (userId: string) => void;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.4;
const DRAG_THRESHOLD = 80;

export function PaidByBottomSheet({
  visible,
  members,
  selectedUserId,
  currentUserId,
  onSelect,
  onClose,
}: PaidByBottomSheetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const checkScales = useRef(members.map(() => new Animated.Value(0))).current;

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
    let bounceTimer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      checkScales.forEach((scale) => scale.setValue(0));

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

      // 시트가 올라오기 시작한 직후 체크 바운스를 시작
      const selectedIdx = members.findIndex(
        (m) => m.user_id === selectedUserId
      );
      bounceTimer = setTimeout(() => {
        if (selectedIdx >= 0 && checkScales[selectedIdx]) {
          Animated.spring(checkScales[selectedIdx], {
            toValue: 1,
            useNativeDriver: true,
            tension: 140,
            friction: 8,
          }).start();
        }
      }, 300);
    } else {
      checkScales.forEach((scale) => scale.setValue(0));
    }

    return () => {
      if (bounceTimer) {
        clearTimeout(bounceTimer);
      }
    };
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

  const handleSelect = (userId: string, index: number) => {
    // 체크 바운스 애니메이션
    checkScales.forEach((scale) => scale.setValue(0));
    Animated.spring(checkScales[index], {
      toValue: 1,
      useNativeDriver: true,
      tension: 140,
      friction: 8,
    }).start();

    onSelect(userId);
    setTimeout(handleClose, 300);
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
              지출자 변경
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* 멤버 리스트 */}
          {members.map((member, index) => {
            const isSelected = member.user_id === selectedUserId;
            const isCurrentUser = member.user_id === currentUserId;

            return (
              <TouchableOpacity
                key={member.user_id}
                style={[
                  styles.memberItem,
                  {
                    backgroundColor: isSelected
                      ? colors.tintLight
                      : 'transparent',
                  },
                ]}
                onPress={() => handleSelect(member.user_id, index)}
                activeOpacity={0.7}
              >
                <View style={styles.memberLeft}>
                  <Text
                    style={[
                      styles.memberName,
                      {
                        color: colors.text,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {member.full_name || '멤버'}
                  </Text>
                  {isCurrentUser && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: colors.tint + '15' },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: colors.tint }]}>
                        나
                      </Text>
                    </View>
                  )}
                </View>

                {isSelected && checkScales[index] && (
                  <Animated.View
                    style={{ transform: [{ scale: checkScales[index] }] }}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.tint}
                    />
                  </Animated.View>
                )}
              </TouchableOpacity>
            );
          })}
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
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 4,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberName: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
