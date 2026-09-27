import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /** 키보드의 검색 키 */
  onSubmit: () => void;
}

// 제목 입력칸(빠른 입력·상세)과 같은 50자
const MAX_LENGTH = 50;
// 헤더 높이(44)가 고정이라 가장 큰 글자 크기에서 입력 글자가 잘리지 않게 막는다
const MAX_FONT_SCALE = 1.3;

/** 검색 화면 헤더에 들어가는 입력칸. 화면에 들어오면 바로 키보드가 올라온다. */
export function SearchInput({
  value,
  onChangeText,
  onSubmit,
}: SearchInputProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const inputRef = useRef<TextInput>(null);

  const clear = () => {
    onChangeText('');
    inputRef.current?.focus();
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <Ionicons
        name="search"
        size={18}
        color={colors.textSecondary}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="제목이나 메모로 검색"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.tint}
        keyboardAppearance={colorScheme}
        style={[styles.input, { color: colors.text }]}
        autoFocus
        returnKeyType="search"
        enablesReturnKeyAutomatically
        autoCorrect={false}
        autoCapitalize="none"
        maxLength={MAX_LENGTH}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        accessibilityLabel="거래 검색어"
      />
      {value.length > 0 && (
        <Pressable
          onPress={clear}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="검색어 지우기"
        >
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // 기본 중앙 슬롯은 alignItems: 'center'라 폭을 채우려면 stretch가 필요하다
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    letterSpacing: -0.3,
    padding: 0,
  },
});
