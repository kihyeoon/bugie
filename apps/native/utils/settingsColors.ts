/**
 * 설정 화면의 색상 로직을 중앙화하는 유틸리티
 */

import type { StyleProp, ViewStyle } from 'react-native';

export interface SettingItemColors {
  label: 'primary' | 'secondary' | 'disabled' | undefined;
  value: 'primary' | 'secondary' | 'disabled' | undefined;
  showChevron: boolean;
  chevronColor?: string;
}

interface GetSettingItemColorsParams {
  isEditable: boolean; // 편집 가능 여부 (권한)
  isEnabled: boolean; // 활성화 여부 (기능 자체)
  isActionable?: boolean; // 클릭 가능 여부
  type?: 'normal' | 'danger' | 'primary';
}

/**
 * 설정 항목의 색상을 결정하는 중앙화된 로직
 *
 * @example
 * // 편집 가능한 일반 항목
 * getSettingItemColors({ isEditable: true, isEnabled: true, isActionable: true })
 * // => { label: undefined, value: undefined, showChevron: true }
 *
 * // 권한 없는 항목
 * getSettingItemColors({ isEditable: false, isEnabled: true, isActionable: false })
 * // => { label: 'secondary', value: 'secondary', showChevron: false }
 */
export function getSettingItemColors({
  isEditable,
  isEnabled,
  isActionable = false,
  type = 'normal',
}: GetSettingItemColorsParams): SettingItemColors {
  // 특수 타입 처리 (멤버 초대, 삭제 등)
  if (type === 'primary') {
    return {
      label: 'primary',
      value: undefined,
      showChevron: true,
      chevronColor: 'tint',
    };
  }

  if (type === 'danger') {
    return {
      label: undefined, // danger 색상은 직접 스타일로 처리
      value: undefined,
      showChevron: true,
      chevronColor: 'danger',
    };
  }

  // 일반 항목 색상 로직

  // 완전 비활성화 (MVP에서 제외된 기능 등)
  if (!isEnabled) {
    return {
      label: 'secondary',
      value: 'secondary',
      showChevron: false,
    };
  }

  // 활성화되었지만 편집 권한 없음
  if (!isEditable && isEnabled) {
    return {
      label: 'secondary',
      value: 'secondary',
      showChevron: false,
    };
  }

  // 편집 가능하고 클릭 가능
  if (isEditable && isActionable) {
    return {
      label: undefined, // primary 색상 사용
      value: undefined, // primary 색상 사용
      showChevron: true,
    };
  }

  // 편집 가능하지만 클릭 불가 (읽기 전용 표시)
  if (isEditable && !isActionable) {
    return {
      label: undefined,
      value: 'secondary',
      showChevron: false,
    };
  }

  // 기본값
  return {
    label: 'secondary',
    value: 'secondary',
    showChevron: false,
  };
}

/**
 * 설정 항목의 스타일을 결정하는 헬퍼 함수
 */
export function getSettingItemStyles(
  isDisabled: boolean,
  baseStyles: StyleProp<ViewStyle>,
  disabledStyles?: StyleProp<ViewStyle>
): StyleProp<ViewStyle> {
  const styles = Array.isArray(baseStyles) ? [...baseStyles] : [baseStyles];
  if (isDisabled && disabledStyles) {
    if (Array.isArray(disabledStyles)) {
      styles.push(...disabledStyles);
    } else {
      styles.push(disabledStyles);
    }
  }
  return styles.flat().filter(Boolean) as StyleProp<ViewStyle>;
}
