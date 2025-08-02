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
    options.findIndex(opt => opt.value === value)
  );
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const index = options.findIndex(opt => opt.value === value);
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

  const indicatorWidth = `${100 / options.length}%` as const;
  const indicatorTranslateX = slideAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => `${i * 100}%`),
  });

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.backgroundSecondary },
      fullWidth && styles.fullWidth,
    ]}>
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: colors.background,
            width: indicatorWidth,
            transform: [{ translateX: indicatorTranslateX }],
          },
        ]}
      />
      
      {options.map((option, index) => {
        const isSelected = selectedIndex === index;
        const textColor = option.color && isSelected
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
            <Text style={[
              styles.optionText,
              { color: textColor },
              isSelected && styles.selectedText,
            ]}>
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