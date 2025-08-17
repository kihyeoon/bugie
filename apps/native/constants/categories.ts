import { Ionicons } from '@expo/vector-icons';

/**
 * 카테고리 시스템에서 사용되는 모든 상수들을 중앙 관리
 * DB의 카테고리 템플릿과 동기화 필요
 */

// ============================================
// 색상 팔레트
// ============================================

/**
 * 카테고리에서 선택 가능한 색상 목록
 * 사용처:
 * - AddCategoryModal: 커스텀 카테고리 색상 선택
 * - CategoryItem: 아이콘 색상 표시
 */
export const CATEGORY_COLOR_PALETTE = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#A855F7', // Purple
  '#6B7280', // Gray (기본값)
] as const;

// ============================================
// 아이콘 매핑
// ============================================

/**
 * DB 아이콘 이름과 Ionicons 이름 매핑
 * DB는 일반적인 아이콘 이름을 저장하고,
 * 프론트엔드에서 실제 Ionicons 이름으로 변환
 */
export const CATEGORY_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> =
  {
    // DB 템플릿 아이콘 (filled 버전)
    utensils: 'restaurant',
    car: 'car',
    'shopping-bag': 'cart',
    film: 'film',
    heart: 'heart',
    home: 'home',
    book: 'book',
    'more-horizontal': 'ellipsis-horizontal',
    briefcase: 'briefcase',
    'trending-up': 'trending-up',
    'bar-chart': 'bar-chart',
    gift: 'gift',
    'plus-circle': 'add-circle',
    pricetag: 'pricetag',
    receipt: 'receipt',

    // 추가 아이콘 (커스텀 카테고리용)
    airplane: 'airplane',
    paw: 'paw',
    fitness: 'fitness',
    cafe: 'cafe',
    beer: 'beer',
    shirt: 'shirt',
    'phone-portrait': 'phone-portrait',
    medkit: 'medkit',
    cash: 'cash',
    card: 'card',
    wallet: 'wallet',
    'game-controller': 'game-controller',
  } as const;

/**
 * DB 아이콘 이름과 Ionicons outline 버전 매핑
 * CategorySelector에서 선택된 카테고리 표시할 때 사용
 */
export const CATEGORY_ICON_MAP_OUTLINE: Record<
  string,
  keyof typeof Ionicons.glyphMap
> = {
  // DB 템플릿 아이콘 (outline 버전)
  utensils: 'restaurant-outline',
  car: 'car-outline',
  'shopping-bag': 'cart-outline',
  film: 'film-outline',
  heart: 'heart-outline',
  home: 'home-outline',
  book: 'book-outline',
  'more-horizontal': 'ellipsis-horizontal',
  briefcase: 'briefcase-outline',
  'trending-up': 'trending-up-outline',
  'bar-chart': 'bar-chart-outline',
  gift: 'gift-outline',
  'plus-circle': 'add-circle-outline',
  pricetag: 'pricetag-outline',
  receipt: 'receipt-outline',

  // 추가 아이콘 (커스텀 카테고리용)
  airplane: 'airplane-outline',
  paw: 'paw-outline',
  fitness: 'fitness-outline',
  cafe: 'cafe-outline',
  beer: 'beer-outline',
  shirt: 'shirt-outline',
  'phone-portrait': 'phone-portrait-outline',
  medkit: 'medkit-outline',
  cash: 'cash-outline',
  card: 'card-outline',
  wallet: 'wallet-outline',
  'game-controller': 'game-controller-outline',
} as const;

/**
 * 커스텀 카테고리 생성시 선택 가능한 아이콘 목록
 * AddCategoryModal에서 사용
 */
export const SELECTABLE_ICONS: {
  name: keyof typeof Ionicons.glyphMap;
  dbValue: string;
  label: string;
}[] = [
  { name: 'cart-outline', dbValue: 'shopping-bag', label: '쇼핑' },
  { name: 'restaurant-outline', dbValue: 'utensils', label: '식사' },
  { name: 'car-outline', dbValue: 'car', label: '교통' },
  { name: 'home-outline', dbValue: 'home', label: '주거' },
  { name: 'heart-outline', dbValue: 'heart', label: '건강' },
  { name: 'book-outline', dbValue: 'book', label: '교육' },
  {
    name: 'game-controller-outline',
    dbValue: 'game-controller',
    label: '오락',
  },
  { name: 'gift-outline', dbValue: 'gift', label: '선물' },
  { name: 'airplane-outline', dbValue: 'airplane', label: '여행' },
  { name: 'paw-outline', dbValue: 'paw', label: '반려동물' },
  { name: 'fitness-outline', dbValue: 'fitness', label: '운동' },
  { name: 'cafe-outline', dbValue: 'cafe', label: '카페' },
  { name: 'beer-outline', dbValue: 'beer', label: '술/유흥' },
  { name: 'shirt-outline', dbValue: 'shirt', label: '의류' },
  { name: 'phone-portrait-outline', dbValue: 'phone-portrait', label: '통신' },
  { name: 'medkit-outline', dbValue: 'medkit', label: '의료' },
  { name: 'cash-outline', dbValue: 'cash', label: '현금' },
  { name: 'card-outline', dbValue: 'card', label: '카드' },
  { name: 'wallet-outline', dbValue: 'wallet', label: '지갑' },
  { name: 'pricetag-outline', dbValue: 'pricetag', label: '기타' },
];

// ============================================
// 헬퍼 함수
// ============================================

/**
 * DB 아이콘 이름을 Ionicons 이름으로 변환
 * @param dbIcon DB에 저장된 아이콘 이름
 * @param outline outline 버전 사용 여부
 * @returns Ionicons 컴포넌트에서 사용할 수 있는 아이콘 이름
 */
export function getIoniconName(
  dbIcon: string,
  outline: boolean = false
): keyof typeof Ionicons.glyphMap {
  const map = outline ? CATEGORY_ICON_MAP_OUTLINE : CATEGORY_ICON_MAP;
  return map[dbIcon] || (outline ? 'pricetag-outline' : 'pricetag');
}

/**
 * Ionicons 이름을 DB 저장용 이름으로 변환
 * @param ioniconName Ionicons 아이콘 이름
 * @returns DB에 저장할 아이콘 이름
 */
export function getDbIconName(
  ioniconName: keyof typeof Ionicons.glyphMap
): string {
  // SELECTABLE_ICONS에서 매칭되는 항목 찾기
  const icon = SELECTABLE_ICONS.find((i) => i.name === ioniconName);
  if (icon) return icon.dbValue;

  // outline 제거하고 반환
  const name = ioniconName.replace('-outline', '');

  // 역매핑 찾기
  for (const [dbName, ionName] of Object.entries(CATEGORY_ICON_MAP)) {
    if (ionName === name) return dbName;
  }

  return 'pricetag'; // 기본값
}

// ============================================
// 기본값
// ============================================

export const DEFAULT_CATEGORY_COLOR = '#6B7280'; // Gray
export const DEFAULT_CATEGORY_ICON = 'pricetag';
export const DEFAULT_CATEGORY_ICON_IONICON: keyof typeof Ionicons.glyphMap =
  'pricetag-outline';
