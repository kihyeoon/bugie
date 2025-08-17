import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CategoryDetail } from '@repo/core';
import { getIoniconName } from '@/constants/categories';

interface CategoryItemProps {
  category: CategoryDetail;
  isSelected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  itemWidth: number;
}

export function CategoryItem({
  category,
  isSelected,
  onPress,
  onLongPress,
  itemWidth,
}: CategoryItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        {
          width: itemWidth,
          backgroundColor: isSelected
            ? colors.tint
            : pressed
              ? colors.backgroundSecondary
              : 'transparent',
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isSelected
              ? 'rgba(255, 255, 255, 0.2)'
              : colors.backgroundSecondary,
          },
        ]}
      >
        <Ionicons
          name={getIoniconName(category.icon, false)}
          size={24}
          color={isSelected ? 'white' : category.color}
        />
      </View>
      <Text
        style={[
          styles.label,
          {
            color: isSelected ? 'white' : colors.text,
            fontWeight: isSelected ? '600' : '500',
          },
        ]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
      {isSelected && (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={16} color="white" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
