import type { EntityId, DomainDate } from '../shared/types';

export interface PaymentMethodEntity {
  id: EntityId;
  ledgerId: EntityId;
  ownerId: EntityId | null;
  isShared: boolean;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: DomainDate;
  updatedAt: DomainDate;
  isDeleted: boolean;
}

export interface CreatePaymentMethodCommand {
  ledgerId: EntityId;
  ownerId: EntityId | null;
  isShared: boolean;
  name: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdatePaymentMethodCommand {
  id: EntityId;
  name?: string;
  icon?: string;
  isShared?: boolean;
  sortOrder?: number;
}

export interface PaymentMethodRepository {
  /** soft-deleted 항목 제외, sort_order → created_at 순 정렬 */
  findByLedger(ledgerId: EntityId): Promise<PaymentMethodEntity[]>;
  /** soft-deleted 항목은 반환하지 않음 (null 반환) */
  findById(id: EntityId): Promise<PaymentMethodEntity | null>;
  create(paymentMethod: Omit<PaymentMethodEntity, 'id'>): Promise<EntityId>;
  update(paymentMethod: PaymentMethodEntity): Promise<void>;
  softDelete(id: EntityId): Promise<boolean>;
}
