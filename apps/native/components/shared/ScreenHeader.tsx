import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';

interface ScreenHeaderProps {
  /** 정적 타이틀. center가 있으면 무시됨 */
  title?: string;
  /** 중앙 커스텀 슬롯. 있으면 title 대신 렌더 */
  center?: React.ReactNode;
  /** 우측 슬롯 */
  right?: React.ReactNode;
  /** 백 버튼 표시 여부 (기본 true) */
  showBack?: boolean;
  /** 백 버튼 동작 (기본 router.back()) */
  onBack?: () => void;
  /** 헤더 배경색 (기본 colors.background) */
  background?: string;
}

// 네이티브 nav bar content 영역과 동등한 높이
const CONTENT_HEIGHT = 44;
// 좌/우 슬롯 폭을 동일하게 잡아 center/title이 시각적 중앙에 오도록 함
const SIDE_SLOT_WIDTH = 44;

export function ScreenHeader({
  title,
  center,
  right,
  showBack = true,
  onBack,
  background,
}: ScreenHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const handleBack = onBack ?? (() => router.back());

  return (
    <View
      accessibilityRole="header"
      style={{
        paddingTop: insets.top,
        backgroundColor: background ?? colors.background,
      }}
    >
      <View style={styles.row}>
        {/* 좌측 슬롯 */}
        <View style={styles.leftSlot}>
          {showBack && (
            <Pressable
              onPress={handleBack}
              hitSlop={8}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          )}
        </View>

        {/* 중앙 슬롯 */}
        <View style={styles.center}>
          {center ?? (
            <Typography variant="body1" weight="600" numberOfLines={1}>
              {title ?? ''}
            </Typography>
          )}
        </View>

        {/* 우측 슬롯 */}
        <View style={styles.rightSlot}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  leftSlot: {
    minWidth: SIDE_SLOT_WIDTH,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightSlot: {
    minWidth: SIDE_SLOT_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    height: CONTENT_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
