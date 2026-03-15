import type { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './types';
import type { PaymentMethodEntity, PaymentMethodRepository } from '../../domain/payment-method/types';
import type { LedgerMemberRepository } from '../../domain/ledger/types';
import type { AuthService } from '../../domain/auth/types';
import { PaymentMethodRules } from '../../domain/payment-method/rules';
import { UnauthorizedError, NotFoundError } from '../../domain/shared/errors';
import { PermissionService } from '../permission/PermissionService';

export class PaymentMethodService {
  constructor(
    private paymentMethodRepo: PaymentMethodRepository,
    private memberRepo: LedgerMemberRepository,
    private authService: AuthService
  ) {}

  async getByLedger(ledgerId: string): Promise<PaymentMethodEntity[]> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const member = await this.memberRepo.findByLedgerAndUser(
      ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    return this.paymentMethodRepo.findByLedger(ledgerId);
  }

  async create(input: CreatePaymentMethodInput): Promise<string> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const member = await this.memberRepo.findByLedgerAndUser(
      input.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    if (!PermissionService.canDo('createPaymentMethod', member.role)) {
      throw new UnauthorizedError('결제 수단을 생성할 권한이 없습니다.');
    }

    const paymentMethod = PaymentMethodRules.createPaymentMethod({
      ledgerId: input.ledgerId,
      ownerId: input.ownerId ?? currentUser.id,
      isShared: input.isShared ?? false,
      name: input.name,
      icon: input.icon,
      sortOrder: input.sortOrder,
    });

    return this.paymentMethodRepo.create(paymentMethod);
  }

  async update(id: string, input: UpdatePaymentMethodInput): Promise<void> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const paymentMethod = await this.paymentMethodRepo.findById(id);
    if (!paymentMethod || paymentMethod.isDeleted) {
      throw new NotFoundError('결제 수단을 찾을 수 없습니다.');
    }

    const member = await this.memberRepo.findByLedgerAndUser(
      paymentMethod.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    if (!PermissionService.canDo('updatePaymentMethod', member.role)) {
      throw new UnauthorizedError('결제 수단을 수정할 권한이 없습니다.');
    }

    const updated = PaymentMethodRules.updatePaymentMethod(paymentMethod, {
      id,
      name: input.name,
      icon: input.icon,
      isShared: input.isShared,
      sortOrder: input.sortOrder,
    });

    await this.paymentMethodRepo.update(updated);
  }

  async softDelete(id: string): Promise<boolean> {
    const currentUser = await this.authService.getCurrentUser();
    if (!currentUser) throw new UnauthorizedError('인증이 필요합니다.');

    const paymentMethod = await this.paymentMethodRepo.findById(id);
    if (!paymentMethod || paymentMethod.isDeleted) {
      throw new NotFoundError('결제 수단을 찾을 수 없습니다.');
    }

    const member = await this.memberRepo.findByLedgerAndUser(
      paymentMethod.ledgerId,
      currentUser.id
    );
    if (!member || !member.isActive) {
      throw new UnauthorizedError('가계부에 접근할 권한이 없습니다.');
    }

    if (!PermissionService.canDo('deletePaymentMethod', member.role)) {
      throw new UnauthorizedError('결제 수단을 삭제할 권한이 없습니다.');
    }

    return this.paymentMethodRepo.softDelete(id);
  }
}
