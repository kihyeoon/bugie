import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Text,
  Keyboard,
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  Typography,
  ToggleSwitch,
  Button,
  AmountDisplay,
} from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { useLedger } from '@/contexts/LedgerContext';
import { useServices } from '@/contexts/ServiceContext';
import type { CategoryDetail } from '@repo/core';

export default function AddTransactionScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { currentLedger } = useLedger();
  const { transactionService } = useServices();

  const [amount, setAmount] = useState('0');
  const [isExpense, setIsExpense] = useState(true);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryDetail | null>(null);
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  // 카테고리 선택 시 제목 자동 채우기
  useEffect(() => {
    if (selectedCategory && !title) {
      setTitle(selectedCategory.name);
    }
  }, [selectedCategory, title]);

  const handleNumberPress = (num: string) => {
    if (amount === '0') {
      setAmount(num);
    } else if (amount.length < 10) {
      // 최대 자릿수 제한
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

  const handleSave = async () => {
    // 유효성 검사
    if (!currentLedger) {
      Alert.alert('알림', '가계부를 선택해주세요.');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('알림', '카테고리를 선택해주세요.');
      return;
    }

    try {
      setSaving(true);

      // 데이터 준비
      const transactionInput = {
        ledgerId: currentLedger.id,
        categoryId: selectedCategory.id,
        amount: parseFloat(amount),
        type: (isExpense ? 'expense' : 'income') as 'expense' | 'income',
        title: title || selectedCategory.name, // 제목이 없으면 카테고리명 사용
        description: memo || undefined,
      };

      // 거래 저장
      await transactionService.createTransaction(transactionInput);

      // 성공 - 홈 화면으로 이동
      router.replace('/(tabs)');
    } catch (error) {
      console.error('거래 저장 실패:', error);
      Alert.alert(
        '저장 실패',
        '거래 저장 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
    } finally {
      setSaving(false);
    }
  };

  // 실제 DB에서 카테고리 가져오기
  const { categories, loading: categoriesLoading } = useCategories(
    isExpense ? 'expense' : 'income'
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Typography variant="h2" style={{ marginBottom: 20 }}>
            빠른 입력
          </Typography>

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
            <Text style={{ color: colors.textSecondary }}>
              카테고리 로딩중...
            </Text>
          ) : categories.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              카테고리가 없습니다
            </Text>
          ) : (
            categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor:
                      selectedCategory?.id === category.id
                        ? colors.tint
                        : colors.backgroundSecondary,
                  },
                ]}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color:
                        selectedCategory?.id === category.id
                          ? 'white'
                          : colors.text,
                    },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* 제목 입력 */}
      <View style={styles.titleSection}>
        <TextInput
          style={[
            styles.titleInput,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
            },
          ]}
          placeholder="거래 제목 (선택)"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
          maxLength={50}
        />
      </View>

      {/* 메모 입력 */}
      <View style={styles.memoSection}>
        <TextInput
          style={[
            styles.memoInput,
            {
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
            },
          ]}
          placeholder="메모 입력 (선택)"
          placeholderTextColor={colors.textSecondary}
          value={memo}
          onChangeText={setMemo}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          multiline
          maxLength={200}
        />
      </View>

      {/* 숫자 키패드 */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['00', '0', '←'],
        ].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.keypadButton,
                  { backgroundColor: colors.backgroundSecondary },
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
                <Text style={[styles.keypadText, { color: colors.text }]}>
                  {key}
                </Text>
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
          disabled={amount === '0' || !selectedCategory || saving}
          onPress={handleSave}
          style={styles.saveButton}
        >
          {saving ? '저장 중...' : '저장하기'}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.select({
      ios: 100,
      android: 80,
    }),
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
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  titleInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    letterSpacing: -0.3,
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
    minHeight: 60,
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
