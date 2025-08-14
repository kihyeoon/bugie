import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface ToggleSwitchProps {
  options: {
    label: string;
    value: string;
    color?: string;
  }[];
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
}

export function ToggleSwitch({
  options,
  value,
  onChange,
  fullWidth = false,
}: ToggleSwitchProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selectedIndex, setSelectedIndex] = useState(
    options.findIndex((opt) => opt.value === value)
  );
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const index = options.findIndex((opt) => opt.value === value);
    setSelectedIndex(index);

    Animated.spring(slideAnim, {
      toValue: index,
      useNativeDriver: false,
      tension: 68,
      friction: 10,
    }).start();
  }, [value, options, slideAnim]);

  const handlePress = (index: number) => {
    onChange(options[index].value);
  };

  // 컨테이너 너비를 측정하고 정확한 위치 계산
  const handleLayout = (event: {
    nativeEvent: { layout: { width: number } };
  }) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  };

  // padding 8px (4px * 2)를 제외한 실제 사용 가능한 너비
  const availableWidth = containerWidth - 8;
  const indicatorWidth = availableWidth / options.length;

  // left 속성을 직접 애니메이션
  const indicatorLeft = slideAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => 4 + i * indicatorWidth),
  });

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
        fullWidth && styles.fullWidth,
      ]}
      onLayout={handleLayout}
    >
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: colors.background,
              width: indicatorWidth,
              left: indicatorLeft,
            },
          ]}
        />
      )}

      {options.map((option, index) => {
        const isSelected = selectedIndex === index;
        const textColor =
          option.color && isSelected
            ? option.color
            : isSelected
              ? colors.text
              : colors.textSecondary;

        return (
          <TouchableOpacity
            key={option.value}
            style={styles.option}
            onPress={() => handlePress(index)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionText,
                { color: textColor },
                isSelected && styles.selectedText,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    position: 'relative',
  },
  fullWidth: {
    width: '100%',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  option: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  selectedText: {
    fontWeight: '600',
  },
});
