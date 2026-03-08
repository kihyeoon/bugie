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
  { name: 'home-outline', dbValue: 'home', label: '은행' },
  { name: 'phone-portrait-outline', dbValue: 'phone-portrait', label: '모바일페이' },
  { name: 'card', dbValue: 'credit-card', label: '신용카드' },
  { name: 'briefcase-outline', dbValue: 'briefcase', label: '법인카드' },
  { name: 'gift-outline', dbValue: 'gift', label: '상품권' },
  { name: 'pricetag-outline', dbValue: 'pricetag', label: '기타' },
];

/** DB 기본값과 동일 */
export const DEFAULT_PAYMENT_METHOD_ICON = 'credit-card';
