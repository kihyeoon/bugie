import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface SelectCurrencyModalProps {
  visible: boolean;
  selectedCurrency: string;
  onSelect: (currency: string) => void;
  onClose: () => void;
}

const CURRENCIES = [
  { code: 'KRW', symbol: '₩', name: '한국 원' },
  { code: 'USD', symbol: '$', name: '미국 달러' },
  { code: 'EUR', symbol: '€', name: '유로' },
  { code: 'JPY', symbol: '¥', name: '일본 엔' },
  { code: 'CNY', symbol: '¥', name: '중국 위안' },
  { code: 'GBP', symbol: '£', name: '영국 파운드' },
  { code: 'AUD', symbol: '$', name: '호주 달러' },
  { code: 'CAD', symbol: '$', name: '캐나다 달러' },
];

export function SelectCurrencyModal({
  visible,
  selectedCurrency,
  onSelect,
  onClose,
}: SelectCurrencyModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [tempCurrency, setTempCurrency] = useState(selectedCurrency);

  useEffect(() => {
    if (visible) {
      setTempCurrency(selectedCurrency);
    }
  }, [visible, selectedCurrency]);

  const handleSave = () => {
    onSelect(tempCurrency);
    onClose();
  };

  const handleClose = () => {
    setTempCurrency(selectedCurrency); // Reset to original
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* 드래그 핸들 */}
        <View style={styles.dragHandle} />

        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose}>
            <Typography variant="body1" color="primary">
              취소
            </Typography>
          </Pressable>
          <Typography variant="h3" weight="600">
            통화 선택
          </Typography>
          <Pressable onPress={handleSave}>
            <Typography variant="body1" weight="600" color="primary">
              완료
            </Typography>
          </Pressable>
        </View>

        {/* Currency List */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.listContainer}>
            {CURRENCIES.map((currency, index) => {
              const isSelected = currency.code === tempCurrency;
              return (
                <Pressable
                  key={currency.code}
                  style={[
                    styles.currencyItem,
                    index !== CURRENCIES.length - 1 && styles.currencyItemBorder,
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setTempCurrency(currency.code)}
                >
                  <View style={styles.currencyLeft}>
                    {isSelected && (
                      <IconSymbol
                        name="checkmark"
                        size={20}
                        color={colors.tint}
                        style={styles.checkIcon}
                      />
                    )}
                    <View style={[styles.currencyInfo, !isSelected && styles.currencyInfoNoCheck]}>
                      <View style={styles.currencyMain}>
                        <Typography variant="h2" weight="600">
                          {currency.symbol}
                        </Typography>
                        <Typography variant="body1" weight="600" style={styles.currencyCode}>
                          {currency.code}
                        </Typography>
                      </View>
                      <Typography variant="caption" color="secondary">
                        {currency.name}
                      </Typography>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#C7C7CC',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    paddingTop: 16,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  currencyItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkIcon: {
    marginRight: 12,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyInfoNoCheck: {
    marginLeft: 32, // checkIcon width + margin
  },
  currencyMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currencyCode: {
    marginLeft: 8,
  },
});