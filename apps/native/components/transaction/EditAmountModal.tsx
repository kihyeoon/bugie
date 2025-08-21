import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import type { CategoryType } from '@repo/core';

interface EditAmountModalProps {
  visible: boolean;
  initialAmount: number;
  type: CategoryType;
  onSave: (amount: number) => Promise<void>;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.6;

export function EditAmountModal({
  visible,
  initialAmount,
  type,
  onSave,
  onClose,
}: EditAmountModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  
  const [amount, setAmount] = useState('0');
  const [isSaving, setIsSaving] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // 초기값 설정
  useEffect(() => {
    if (visible) {
      setAmount(initialAmount.toString());
    }
  }, [visible, initialAmount]);

  // 애니메이션 처리
  useEffect(() => {
    if (visible) {
      // 열기 애니메이션
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  // 숫자 키패드 핸들러
  const handleNumberPress = (num: string) => {
    if (amount === '0') {
      setAmount(num);
    } else if (amount.length < 10) {
      setAmount(amount + num);
    }
  };

  const handleDoubleZero = () => {
    if (amount !== '0' && amount.length < 9) {
      setAmount(amount + '00');
    }
  };

  const handleBackspace = () => {
    if (amount.length > 1) {
      setAmount(amount.slice(0, -1));
    } else {
      setAmount('0');
    }
  };

  const handleClose = () => {
    // 닫기 애니메이션
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose(); // 애니메이션 완료 후 호출
    });
  };

  const handleSave = async () => {
    const numAmount = parseInt(amount);
    if (numAmount === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(numAmount);
      handleClose(); // 애니메이션과 함께 닫기
    } catch {
      // 에러는 상위에서 처리
    } finally {
      setIsSaving(false);
    }
  };

  // 포맷팅된 금액 표시
  const formatAmount = () => {
    const num = parseInt(amount);
    if (num === 0) return '0';
    return num.toLocaleString('ko-KR');
  };

  // 금액 색상
  const amountColor = type === 'income' ? colors.income : colors.expense;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* 어두운 배경 */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View 
            style={[
              styles.overlay,
              { opacity: opacityAnim }
            ]} 
          />
        </TouchableWithoutFeedback>

        {/* 모달 콘텐츠 */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
        {/* 헤더 */}
        <View style={styles.header}>
          <Typography variant="h3">금액 수정</Typography>
          <TouchableOpacity onPress={handleClose} disabled={isSaving}>
            <Typography variant="body1" color="secondary">
              취소
            </Typography>
          </TouchableOpacity>
        </View>

        {/* 금액 표시 */}
        <View style={styles.amountDisplay}>
          <Text style={[styles.currencySymbol, { color: amountColor }]}>₩</Text>
          <Text style={[styles.amount, { color: amountColor }]}>
            {formatAmount()}
          </Text>
        </View>

        {/* 숫자 키패드 */}
        <View style={styles.keypad}>
          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('1')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('2')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('3')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>3</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('4')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('5')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>5</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('6')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>6</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('7')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>7</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('8')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>8</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('9')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>9</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.keypadRow}>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={handleDoubleZero}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>00</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => handleNumberPress('0')}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, { backgroundColor: colors.backgroundSecondary }]}
              onPress={handleBackspace}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: colors.tint,
              opacity: amount === '0' || isSaving ? 0.5 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={amount === '0' || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>저장하기</Text>
          )}
        </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '600',
    marginRight: 8,
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  keypad: {
    gap: 12,
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 12,
  },
  key: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
  },
});