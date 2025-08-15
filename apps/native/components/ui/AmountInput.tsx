import React, { useState, useRef } from 'react';
import {
  TextInput,
  Pressable,
  StyleSheet,
  ViewStyle,
  Keyboard,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AmountDisplay } from './AmountDisplay';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  type?: 'income' | 'expense' | 'neutral';
  maxValue?: number;
  minValue?: number;
  style?: ViewStyle;
}

export function AmountInput({
  value,
  onChange,
  type = 'neutral',
  maxValue = 9_999_999_999,
  minValue = 0,
  style,
}: AmountInputProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const inputRef = useRef<TextInput>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // 포맷팅 함수
  const formatWithComma = (num: number): string => {
    if (num === 0) return '';
    return num.toLocaleString('ko-KR');
  };

  // 숫자 추출 함수
  const parseNumber = (text: string): number => {
    const numOnly = text.replace(/[^0-9]/g, '');
    return parseInt(numOnly) || 0;
  };

  // 편집 시작
  const handleStartEdit = () => {
    const formatted = value === 0 ? '' : formatWithComma(value);
    setInputValue(formatted);
    setIsEditing(true);
  };

  // 텍스트 변경
  const handleTextChange = (text: string) => {
    const num = parseNumber(text);
    
    // 최대값 체크
    if (num > maxValue) {
      return;
    }
    
    // 포맷팅하여 표시
    const formatted = num === 0 ? '' : formatWithComma(num);
    setInputValue(formatted);
  };

  // 편집 완료
  const handleEndEdit = () => {
    const num = parseNumber(inputValue);
    
    // 범위 체크
    const finalValue = Math.min(Math.max(num, minValue), maxValue);
    onChange(finalValue);
    
    setIsEditing(false);
    Keyboard.dismiss();
  };

  // 색상 결정
  const getColor = () => {
    if (type === 'income') return colors.income;
    if (type === 'expense') return colors.expense;
    return colors.text;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        style,
        !isEditing && pressed && styles.pressed
      ]}
      onPress={handleStartEdit}
      disabled={isEditing}
    >
      {isEditing ? (
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { color: getColor() }
          ]}
          value={inputValue}
          onChangeText={handleTextChange}
          onBlur={handleEndEdit}
          onSubmitEditing={handleEndEdit}
          keyboardType="number-pad"
          returnKeyType="done"
          autoFocus
          placeholder="0"
          placeholderTextColor={getColor()}
          maxLength={13}
        />
      ) : (
        <AmountDisplay
          amount={value}
          type={type}
          size="xlarge"
          showSign={false}
          currency=""
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  pressed: {
    opacity: 0.7,
  },
  input: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
    minWidth: 200,
  },
});