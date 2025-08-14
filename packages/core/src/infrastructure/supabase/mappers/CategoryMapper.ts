import type { 
  Category as DbCategory,
  CategoryTemplate as DbCategoryTemplate,
  CategoryType as DbCategoryType 
} from '@repo/types';
import type { 
  CategoryEntity,
  CategoryType 
} from '../../../domain/ledger/types';

/**
 * 카테고리 DB ↔ Domain 매핑
 */
export class CategoryMapper {
  /**
   * DB 카테고리 → Domain 변환
   */
  static toDomain(db: DbCategory): CategoryEntity {
    return {
      id: db.id,
      ledgerId: db.ledger_id,
      name: db.name || '', // 커스텀 카테고리인 경우
      type: db.type as CategoryType,
      color: db.color || '#6B7280',
      icon: db.icon || 'tag',
      sortOrder: db.sort_order || 0,
      isTemplate: db.template_id !== null,
      templateId: db.template_id ?? undefined,
      isActive: db.is_active && db.deleted_at === null
    };
  }

  /**
   * Domain → DB 변환 (업데이트용)
   */
  static toDb(domain: CategoryEntity): Partial<DbCategory> {
    return {
      id: domain.id,
      ledger_id: domain.ledgerId,
      name: domain.isTemplate ? undefined : domain.name,
      type: domain.type as DbCategoryType,
      color: domain.color,
      icon: domain.icon,
      sort_order: domain.sortOrder,
      template_id: domain.templateId ?? undefined,
      is_active: domain.isActive,
      ...(domain.isActive === false && { deleted_at: new Date().toISOString() })
    };
  }

  /**
   * Domain → DB 변환 (생성용, ID 제외)
   */
  static toDbForCreate(domain: Omit<CategoryEntity, 'id'>): Partial<DbCategory> {
    return {
      ledger_id: domain.ledgerId,
      name: domain.isTemplate ? undefined : domain.name,
      type: domain.type as DbCategoryType,
      color: domain.color,
      icon: domain.icon,
      sort_order: domain.sortOrder,
      template_id: domain.templateId ?? undefined,
      is_active: domain.isActive
    };
  }

  /**
   * DB 카테고리 템플릿 → Domain 변환
   * 템플릿은 가계부별 카테고리로 변환됨
   */
  static templateToDomain(
    template: DbCategoryTemplate, 
    ledgerId: string
  ): CategoryEntity {
    return {
      id: '', // 새로 생성될 때 ID 할당
      ledgerId,
      name: template.name,
      type: template.type as CategoryType,
      color: template.color || '#3B82F6',
      icon: template.icon || 'receipt',
      sortOrder: template.sort_order || 0,
      isTemplate: true,
      templateId: template.id,
      isActive: true
    };
  }

  /**
   * 카테고리 뷰 데이터 → Domain 변환
   * category_details 뷰에서 조회한 데이터 변환용
   */
  static viewToDomain(view: {
    id: string;
    ledger_id: string;
    name: string;
    type: 'income' | 'expense';
    color: string;
    icon: string;
    sort_order: number;
    source_type: 'template' | 'custom';
    template_id?: string;
    is_active: boolean;
  }): CategoryEntity {
    return {
      id: view.id,
      ledgerId: view.ledger_id,
      name: view.name,
      type: view.type as CategoryType,
      color: view.color,
      icon: view.icon,
      sortOrder: view.sort_order,
      isTemplate: view.source_type === 'template',
      templateId: view.template_id ?? undefined,
      isActive: view.is_active
    };
  }

  /**
   * 템플릿을 글로벌 카테고리로 변환 (가계부 ID 없이)
   * getTemplates에서 사용
   */
  static templateToGlobalDomain(template: DbCategoryTemplate): CategoryEntity {
    return {
      id: template.id,
      ledgerId: '', // 템플릿은 특정 가계부에 속하지 않음
      name: template.name,
      type: template.type as CategoryType,
      color: template.color || '#3B82F6',
      icon: template.icon || 'receipt',
      sortOrder: template.sort_order || 0,
      isTemplate: true,
      isActive: true
    };
  }
}