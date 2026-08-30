import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';

interface ModalHeaderProps {
  title: string;
  /** 왼쪽 액션(주로 닫기/취소). 생략하면 빈 자리로 둔다. */
  left?: React.ReactNode;
  /** 오른쪽 액션(주로 확인/저장). 생략하면 빈 자리로 둔다. */
  right?: React.ReactNode;
  /** 드래그 핸들 표시 여부 (pageSheet 모달 기본값 true) */
  showDragHandle?: boolean;
}

/**
 * pageSheet 모달 공용 헤더 (드래그 핸들 + 3분할 헤더)
 *
 * 제목을 absolute로 화면 정중앙에 고정한다. 좌우 액션의 글자 수가 달라도
 * 제목이 밀리지 않는다 — 이전에는 모달마다 좌우 슬롯 폭이 제각각이라
 * ('닫기' 40px vs 스페이서 36px vs 아이콘 24px) 제목 위치가 미묘하게 달랐다.
 */
export function ModalHeader({
  title,
  left,
  right,
  showDragHandle = true,
}: ModalHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <>
      {showDragHandle && <View style={styles.dragHandle} />}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {/* 제목: 좌우 액션과 무관하게 항상 정중앙 */}
        <View style={styles.titleWrap} pointerEvents="none">
          <Typography variant="h3" weight="600">
            {title}
          </Typography>
        </View>

        <View style={styles.side}>{left}</View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </>
  );
}

/** 헤더에 넣는 텍스트 버튼 (닫기/취소/확인 등) */
export function ModalHeaderButton({
  label,
  onPress,
  disabled,
  bold,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      <Typography
        variant="body1"
        color={disabled ? 'disabled' : 'primary'}
        weight={bold ? '600' : '400'}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
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
  titleWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  side: {
    minWidth: 44,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
});
