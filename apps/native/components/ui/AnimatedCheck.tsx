import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AnimatedCheckProps {
  visible: boolean;
  color: string;
  size?: number;
}

export function AnimatedCheck({
  visible,
  color,
  size = 22,
}: AnimatedCheckProps) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 140,
        friction: 8,
      }).start();
    } else {
      scale.setValue(0);
    }
  }, [visible, scale]);

  if (!visible) return null;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name="checkmark-circle" size={size} color={color} />
    </Animated.View>
  );
}
