export interface CreatePaymentMethodInput {
  ledgerId: string;
  /** null = 공유 결제 수단(소유자 없음), undefined = 현재 사용자 자동 할당 */
  ownerId?: string | null;
  isShared?: boolean;
  name: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdatePaymentMethodInput {
  name?: string;
  icon?: string;
  isShared?: boolean;
  sortOrder?: number;
}
