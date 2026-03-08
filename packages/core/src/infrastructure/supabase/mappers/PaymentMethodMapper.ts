import type { PaymentMethod as DbPaymentMethod } from '@repo/types';
import type { PaymentMethodEntity } from '../../../domain/payment-method/types';

export class PaymentMethodMapper {
  static toDomain(db: DbPaymentMethod): PaymentMethodEntity {
    return {
      id: db.id,
      ledgerId: db.ledger_id,
      ownerId: db.owner_id ?? null,
      isShared: db.is_shared,
      name: db.name,
      icon: db.icon ?? 'credit-card',
      sortOrder: db.sort_order ?? 0,
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
      isDeleted: db.deleted_at !== null,
    };
  }

  static toDb(domain: PaymentMethodEntity): Partial<DbPaymentMethod> {
    return {
      id: domain.id,
      ledger_id: domain.ledgerId,
      owner_id: domain.ownerId,
      is_shared: domain.isShared,
      name: domain.name,
      icon: domain.icon,
      sort_order: domain.sortOrder,
      created_at: domain.createdAt.toISOString(),
      updated_at: domain.updatedAt.toISOString(),
      ...(domain.isDeleted && { deleted_at: new Date().toISOString() }),
    };
  }

  static toDbForCreate(
    domain: Omit<PaymentMethodEntity, 'id'>
  ): Partial<DbPaymentMethod> {
    return {
      ledger_id: domain.ledgerId,
      owner_id: domain.ownerId,
      is_shared: domain.isShared,
      name: domain.name,
      icon: domain.icon,
      sort_order: domain.sortOrder,
      created_at: domain.createdAt.toISOString(),
      updated_at: domain.updatedAt.toISOString(),
    };
  }
}
