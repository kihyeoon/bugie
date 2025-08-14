import { StyleSheet, TextInput, TouchableOpacity, View, Text, Keyboard } from 'react-native';
import { useState } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, ToggleSwitch, Button, AmountDisplay } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import type { CategoryDetail } from '@repo/core';

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [amount, setAmount] = useState('0');
  const [isExpense, setIsExpense] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetail | null>(null);

  const handleNumberPress = (num: string) => {
    if (amount === '0') {
      setAmount(num);
    } else if (amount.length < 10) { // 최대 자릿수 제한
      setAmount(amount + num);
    }
  };

  const handleDelete = () => {
    if (amount.length > 1) {
      setAmount(amount.slice(0, -1));
    } else {
      setAmount('0');
    }
  };

  // 실제 DB에서 카테고리 가져오기
  const { categories, loading: categoriesLoading } = useCategories(isExpense ? 'expense' : 'income');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Typography variant="h2" style={{ marginBottom: 20 }}>빠른 입력</Typography>
        
        {/* 수입/지출 토글 */}
        <ToggleSwitch
          options={[
            { label: '수입', value: 'income', color: colors.income },
            { label: '지출', value: 'expense', color: colors.expense },
          ]}
          value={isExpense ? 'expense' : 'income'}
          onChange={(value) => setIsExpense(value === 'expense')}
          fullWidth
        />
      </View>

      {/* 금액 표시 */}
      <View style={styles.amountContainer}>
        <AmountDisplay
          amount={parseInt(amount)}
          type={isExpense ? 'expense' : 'income'}
          size="xlarge"
          showSign={false}
        />
      </View>

      {/* 카테고리 선택 */}
      <View style={styles.categorySection}>
        <View style={styles.categoryContainer}>
          {categoriesLoading ? (
            <Text style={{ color: colors.textSecondary }}>카테고리 로딩중...</Text>
          ) : categories.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>카테고리가 없습니다</Text>
          ) : (
            categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  { 
                    backgroundColor: selectedCategory?.id === category.id 
                      ? colors.tint 
                      : colors.backgroundSecondary 
                  }
                ]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.categoryText,
                  { 
                    color: selectedCategory?.id === category.id 
                      ? 'white' 
                      : colors.text 
                  }
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* 메모 입력 */}
      <View style={styles.memoSection}>
        <TextInput
          style={[
            styles.memoInput,
            { 
              backgroundColor: colors.backgroundSecondary,
              color: colors.text
            }
          ]}
          placeholder="메모 입력 (선택)"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
      </View>

      {/* 숫자 키패드 */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['00', '0', '←']
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.keypadButton,
                  { backgroundColor: colors.backgroundSecondary }
                ]}
                onPress={() => {
                  if (key === '←') {
                    handleDelete();
                  } else {
                    handleNumberPress(key);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.keypadText, { color: colors.text }]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* 저장 버튼 */}
      <Button
        variant="primary"
        size="large"
        fullWidth
        disabled={amount === '0' || !selectedCategory}
        style={styles.saveButton}
      >
        저장하기
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  amountContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  categorySection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  memoSection: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  memoInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  keypad: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  keypadButton: {
    flex: 1,
    aspectRatio: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  keypadText: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  saveButton: {
    marginHorizontal: 24,
    marginBottom: 20,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});