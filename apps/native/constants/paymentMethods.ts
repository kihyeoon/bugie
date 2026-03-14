import { Ionicons } from '@expo/vector-icons';

/**
 * 결제 수단 전용 아이콘 목록
 * 기존 SELECTABLE_ICONS와 동일한 구조 (Ionicons 이름 체계)
 */
export const PAYMENT_METHOD_ICONS: {
  name: keyof typeof Ionicons.glyphMap;
  dbValue: string;
  label: string;
}[] = [
  { name: 'card-outline', dbValue: 'card', label: '카드' },
  { name: 'cash-outline', dbValue: 'cash', label: '현금' },
  { name: 'wallet-outline', dbValue: 'wallet', label: '지갑' },
  { name: 'home-outline', dbValue: 'home', label: '집' },
  {
    name: 'phone-portrait-outline',
    dbValue: 'phone-portrait',
    label: '모바일페이',
  },

  { name: 'briefcase-outline', dbValue: 'briefcase', label: '서류가방' },
  { name: 'gift-outline', dbValue: 'gift', label: '상품권' },
  { name: 'pricetag-outline', dbValue: 'pricetag', label: '태그' },

  { name: 'qr-code-outline', dbValue: 'qr-code', label: 'QR코드' },
  { name: 'bus-outline', dbValue: 'bus', label: '버스' },
  { name: 'storefront-outline', dbValue: 'storefront', label: '상점' },
  { name: 'globe-outline', dbValue: 'globe', label: '지구본' },
  { name: 'star-outline', dbValue: 'star', label: '별' },
  { name: 'calculator-outline', dbValue: 'calculator', label: '계산기' },
  { name: 'diamond-outline', dbValue: 'diamond', label: '다이아몬드' },
];

/** DB 기본값과 동일 */
export const DEFAULT_PAYMENT_METHOD_ICON = 'card';

