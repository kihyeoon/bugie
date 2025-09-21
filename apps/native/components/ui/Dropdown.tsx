import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  ScrollView,
  ViewStyle,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface TriggerProps {
  ref?: React.Ref<View>;
  onPress?: () => void;
}

interface DropdownProps {
  trigger: React.ReactElement<TriggerProps>;
  children: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  maxHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  alignment?: 'left' | 'center' | 'right';
  offset?: number;
  containerStyle?: ViewStyle;
  dropdownStyle?: ViewStyle;
}

const ANIMATION_DURATION = 200;

export function Dropdown({
  trigger,
  children,
  isOpen: controlledIsOpen,
  onOpenChange,
  maxHeight = 300,
  minWidth = 180,
  maxWidth = 320,
  alignment = 'center',
  offset = 0,
  containerStyle,
  dropdownStyle,
}: DropdownProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // State
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  // Refs
  const triggerRef = useRef<View>(null);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const opacityValue = useRef(new Animated.Value(0)).current;
  
  // Controlled vs uncontrolled
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const setIsOpen = useCallback((open: boolean) => {
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    onOpenChange?.(open);
  }, [controlledIsOpen, onOpenChange]);

  // Measure trigger position
  const measureTrigger = useCallback(() => {
    if (triggerRef.current) {
      // Measure trigger position in window
      triggerRef.current.measureInWindow((x, y, width, height) => {
        // Position dropdown directly below trigger with offset
        // SafeArea 보정: SafeAreaView 내부 컴포넌트의 window 좌표에서 SafeArea top을 빼줌
        const topPosition = y + height + offset - insets.top;

        // Calculate dropdown width with min/max constraints
        // 버튼 너비를 기준으로 하되, 최소/최대값 적용
        const dropdownWidth = Math.min(maxWidth, Math.max(minWidth, width));
        const screenWidth = Dimensions.get('window').width;

        // Calculate left position based on alignment
        let leftPosition: number;

        switch (alignment) {
          case 'left':
            leftPosition = x; // Use trigger's absolute x position
            break;
          case 'right':
            leftPosition = x + width - dropdownWidth;
            break;
          case 'center':
          default:
            leftPosition = x - (dropdownWidth - width) / 2;
            break;
        }

        // Ensure dropdown doesn't go off screen
        // left alignment일 때는 화면 경계 체크하지 않음 (버튼 위치 그대로 사용)
        if (alignment !== 'left') {
          const padding = 16;
          leftPosition = Math.max(padding, leftPosition);
          leftPosition = Math.min(leftPosition, screenWidth - dropdownWidth - padding);
        }

        setDropdownPosition({
          top: topPosition,
          left: leftPosition,
          width: dropdownWidth,
        });
      });
    }
  }, [offset, minWidth, maxWidth, alignment, insets.top]);

  // Handle open/close
  const handleToggle = useCallback(() => {
    const newIsOpen = !isOpen;
    
    if (newIsOpen) {
      measureTrigger();
    }
    
    setIsOpen(newIsOpen);
  }, [isOpen, measureTrigger, setIsOpen]);

  // Animation effect
  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isOpen ? maxHeight : 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: false, // Height animation needs native driver false
      }),
      Animated.timing(opacityValue, {
        toValue: isOpen ? 1 : 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: false, // Changed to false to match height animation
      }),
    ]).start();
  }, [isOpen, animatedHeight, opacityValue, maxHeight]);

  // Handle backdrop press
  const handleBackdropPress = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Clone trigger with ref and onPress
  const triggerElement = React.cloneElement(trigger, {
    ref: triggerRef,
    onPress: handleToggle,
  });

  return (
    <>
      <View style={[styles.container, containerStyle]}>
        {triggerElement}
      </View>

      {isOpen && (
        <>
          <TouchableWithoutFeedback onPress={handleBackdropPress}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.dropdown,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                height: animatedHeight,
                opacity: opacityValue,
              },
              dropdownStyle,
            ]}
            pointerEvents={isOpen ? 'auto' : 'none'}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled={true}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  dropdown: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});