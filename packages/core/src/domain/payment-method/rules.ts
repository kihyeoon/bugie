import type { CategoryType } from '../ledger/types';
import type { EntityId } from '../shared/types';
import type {
  PaymentMethodEntity,
  CreatePaymentMethodCommand,
  UpdatePaymentMethodCommand,
} from './types';
import { ValidationError } from '../shared/errors';
import { PAYMENT_METHOD_MAX_NAME_LENGTH } from '../shared/constants';

export const PaymentMethodRules = {
  MAX_NAME_LENGTH: PAYMENT_METHOD_MAX_NAME_LENGTH,

  validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('결제 수단 이름은 필수입니다');
    }
    if (name.length > this.MAX_NAME_LENGTH) {
      throw new ValidationError(
        `결제 수단 이름은 ${this.MAX_NAME_LENGTH}자를 초과할 수 없습니다`
      );
    }
  },

  canAttachPaymentMethod(transactionType: CategoryType): boolean {
    return transactionType === 'expense';
  },

  sanitizePaymentMethodOnTypeChange(
    newType: CategoryType,
    paymentMethodId: EntityId | null | undefined
  ): EntityId | undefined {
    return this.canAttachPaymentMethod(newType)
      ? (paymentMethodId ?? undefined)
      : undefined;
  },

  createPaymentMethod(
    command: CreatePaymentMethodCommand
  ): Omit<PaymentMethodEntity, 'id'> {
    this.validateName(command.name);

    return {
      ledgerId: command.ledgerId,
      ownerId: command.ownerId,
      isShared: command.isShared,
      name: command.name.trim(),
      icon: command.icon ?? 'card',
      sortOrder: command.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };
  },

  updatePaymentMethod(
    paymentMethod: PaymentMethodEntity,
    command: UpdatePaymentMethodCommand
  ): PaymentMethodEntity {
    const updated = { ...paymentMethod };

    if (command.name !== undefined) {
      this.validateName(command.name);
      updated.name = command.name.trim();
    }

    if (command.icon !== undefined) {
      updated.icon = command.icon;
    }

    if (command.isShared !== undefined) {
      updated.isShared = command.isShared;
    }

    if (command.sortOrder !== undefined) {
      updated.sortOrder = command.sortOrder;
    }

    updated.updatedAt = new Date();

    return updated;
  },
};
