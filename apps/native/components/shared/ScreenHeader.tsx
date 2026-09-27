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
  /**
   * 중앙을 내용 폭으로 두고 좌/우가 남는 공간을 똑같이 나눈다 (기본 false = 좌/우 44 고정).
   * 우측에 44보다 넓은 내용을 두면서 중앙을 화면 가운데에 유지할 때 쓴다. 우측 내용은 남는 폭 안에서 줄어들어야 한다.
   */
  fitCenter?: boolean;
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
  fitCenter = false,
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
        <View style={[styles.leftSlot, fitCenter && styles.flexibleSlot]}>
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
        <View style={fitCenter ? styles.fittedCenter : styles.center}>
          {center ?? (
            <Typography variant="body1" weight="600" numberOfLines={1}>
              {title ?? ''}
            </Typography>
          )}
        </View>

        {/* 우측 슬롯 */}
        <View style={[styles.rightSlot, fitCenter && styles.flexibleSlot]}>
          {right}
        </View>
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
  // 좌/우가 flex 1로 같은 폭을 가져가야 내용 폭의 중앙이 화면 가운데에 온다
  flexibleSlot: {
    flex: 1,
  },
  fittedCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    // 넓어진 좌/우 내용이 중앙에 붙지 않게. 양쪽 같은 값이라 중앙 정렬은 그대로다
    marginHorizontal: 8,
  },
  backButton: {
    height: CONTENT_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
