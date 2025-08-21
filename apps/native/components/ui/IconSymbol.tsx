// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chart.pie.fill': 'pie-chart',
  plus: 'add',
  ellipsis: 'more-horiz',
  // 더보기 탭 아이콘들 (iOS SF Symbols → Material Icons)
  'list.bullet': 'list',
  'folder.fill': 'folder',
  'person.fill': 'person',
  'gearshape.fill': 'settings',
  // 로그아웃 아이콘
  'rectangle.portrait.and.arrow.right': 'exit-to-app',
  // 가계부 관리 아이콘들
  'checkmark.circle.fill': 'check-circle',
  'circle': 'radio-button-off',
  'plus.circle.fill': 'add-circle',
} as const;

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name] as ComponentProps<typeof MaterialIcons>['name']}
      style={style}
    />
  );
}
