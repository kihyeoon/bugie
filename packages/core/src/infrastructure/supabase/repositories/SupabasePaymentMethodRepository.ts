import type { SupabaseClient } from '@supabase/supabase-js';
import type { EntityId } from '../../../domain/shared/types';
import type {
  PaymentMethodEntity,
  PaymentMethodRepository,
} from '../../../domain/payment-method/types';
import { PaymentMethodMapper } from '../mappers/PaymentMethodMapper';

export class SupabasePaymentMethodRepository implements PaymentMethodRepository {
  constructor(private supabase: SupabaseClient) {}

  async findByLedger(ledgerId: EntityId): Promise<PaymentMethodEntity[]> {
    const { data, error } = await this.supabase
      .from('payment_methods')
      .select('*')
      .eq('ledger_id', ledgerId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map(PaymentMethodMapper.toDomain);
  }

  async findById(id: EntityId): Promise<PaymentMethodEntity | null> {
    const { data, error } = await this.supabase
      .from('payment_methods')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;

    return PaymentMethodMapper.toDomain(data);
  }

  async create(
    paymentMethod: Omit<PaymentMethodEntity, 'id'>
  ): Promise<EntityId> {
    const dbData = PaymentMethodMapper.toDbForCreate(paymentMethod);

    const { data, error } = await this.supabase
      .from('payment_methods')
      .insert(dbData)
      .select('id')
      .single();

    if (error) throw error;
    if (!data) throw new Error('결제 수단 생성에 실패했습니다.');

    return data.id;
  }

  async update(paymentMethod: PaymentMethodEntity): Promise<void> {
    const dbData = PaymentMethodMapper.toDb(paymentMethod);

    const { error } = await this.supabase
      .from('payment_methods')
      .update(dbData)
      .eq('id', paymentMethod.id);

    if (error) throw error;
  }

  async softDelete(id: EntityId): Promise<boolean> {
    const { data, error } = await this.supabase.rpc(
      'soft_delete_payment_method',
      { target_id: id }
    );

    if (error) throw error;

    return data === true;
  }
}
