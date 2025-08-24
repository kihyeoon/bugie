import type { MemberRole } from '../../domain/ledger/types';

/**
 * 중앙화된 권한 관리 서비스
 *
 * MVP에서는 owner/member 2단계만 활성화하되,
 * 향후 admin/viewer 추가를 대비한 확장 가능한 구조
 */
export class PermissionService {
  // MVP에서 실제 사용하는 권한
  private static readonly ACTIVE_ROLES = ['owner', 'member'] as const;

  // 향후 확장을 위해 주석 처리
  // private static readonly FUTURE_ROLES = ['admin', 'viewer'] as const;

  /**
   * 중앙화된 권한 정책 정의
   * 모든 권한 규칙을 한 곳에서 관리
   */
  private static readonly PERMISSIONS = {
    // 가계부 관리
    updateLedger: ['owner'], // MVP: 소유자만 가능
    deleteLedger: ['owner'],

    // 멤버 관리
    inviteMember: ['owner'],
    removeMember: ['owner'],
    updateMemberRole: ['owner'],
    viewMembers: ['owner', 'member'],

    // 거래 관리
    createTransaction: ['owner', 'member'],
    updateTransaction: ['owner', 'member'],
    deleteTransaction: ['owner', 'member'],
    viewTransactions: ['owner', 'member'],

    // 카테고리 관리
    createCategory: ['owner', 'member'],
    updateCategory: ['owner', 'member'],
    deleteCategory: ['owner', 'member'],
    viewCategories: ['owner', 'member'],

    // 예산 관리 (향후 구현)
    manageBudget: ['owner', 'member'],
    viewBudget: ['owner', 'member'],
  } as const;

  /**
   * 사용자가 특정 작업을 수행할 수 있는지 체크
   */
  static canDo(
    action: keyof typeof PermissionService.PERMISSIONS,
    userRole: MemberRole | null | undefined
  ): boolean {
    if (!userRole) return false;

    // MVP 단순화: admin→member, viewer→member로 매핑
    const effectiveRole = this.mapToActiveRole(userRole);
    const allowedRoles = this.PERMISSIONS[action] as readonly string[];
    return allowedRoles.includes(effectiveRole);
  }

  /**
   * MVP용 역할 매핑 (4단계 → 2단계)
   * DB에는 4가지 권한이 있지만, MVP에서는 2가지만 사용
   */
  private static mapToActiveRole(role: MemberRole): 'owner' | 'member' {
    switch (role) {
      case 'owner':
        return 'owner';
      case 'admin':
      case 'member':
      case 'viewer':
        return 'member';
      default:
        return 'member';
    }
  }

  /**
   * UI 컴포넌트용 Helper 메서드들
   */
  static isOwner(role: MemberRole | null | undefined): boolean {
    return role === 'owner';
  }

  static canManageMembers(role: MemberRole | null | undefined): boolean {
    return this.canDo('inviteMember', role);
  }

  static canEditTransaction(role: MemberRole | null | undefined): boolean {
    return this.canDo('updateTransaction', role);
  }

  static canDeleteTransaction(role: MemberRole | null | undefined): boolean {
    return this.canDo('deleteTransaction', role);
  }

  static canEditLedger(role: MemberRole | null | undefined): boolean {
    return this.canDo('updateLedger', role);
  }

  static canDeleteLedger(role: MemberRole | null | undefined): boolean {
    return this.canDo('deleteLedger', role);
  }

  /**
   * 권한별 UI 텍스트 제공
   */
  static getRoleDisplayName(role: MemberRole): string {
    const displayNames: Record<MemberRole, string> = {
      owner: '소유자',
      admin: '멤버', // MVP: admin은 멤버로 표시
      member: '멤버',
      viewer: '멤버', // MVP: viewer도 멤버로 표시
    };
    return displayNames[role];
  }

  static getRoleDescription(role: MemberRole | null | undefined): string {
    if (!role) return '';

    const effectiveRole = this.mapToActiveRole(role);
    const descriptions = {
      owner:
        '가계부의 모든 권한을 가집니다. 멤버를 초대하고 가계부를 삭제할 수 있습니다.',
      member: '거래를 입력하고 관리할 수 있습니다.',
    };
    return descriptions[effectiveRole];
  }

  /**
   * 권한별 UI 설정 (색상, 아이콘 등)
   * React Native 컴포넌트에서 직접 사용
   */
  static getRoleUIConfig(role: MemberRole): {
    icon: string; // IconSymbolName은 UI 레이어에서 처리
    color: string;
    label: string;
  } {
    const effectiveRole = this.mapToActiveRole(role);

    const configs = {
      owner: {
        icon: 'crown.fill',
        color: '#FFB800',
        label: '소유자',
      },
      member: {
        icon: 'person.fill',
        color: '#191F28',
        label: '멤버',
      },
    };

    return configs[effectiveRole];
  }

  /**
   * 초대 가능한 역할 목록 반환
   * MVP에서는 member만 반환
   */
  static getInvitableRoles(): MemberRole[] {
    return ['member'];
    // 향후 확장 시: return ['admin', 'member', 'viewer'];
  }

  /**
   * 역할 변경 가능 여부 체크
   * MVP에서는 owner만 가능하고, owner 권한은 변경 불가
   */
  static canChangeRole(
    currentUserRole: MemberRole | null | undefined,
    targetUserRole: MemberRole,
    newRole: MemberRole
  ): boolean {
    // owner만 권한 변경 가능
    if (!this.isOwner(currentUserRole)) return false;

    // owner 권한은 변경 불가 (양도는 별도 프로세스)
    if (targetUserRole === 'owner') return false;
    if (newRole === 'owner') return false;

    return true;
  }

  /**
   * 멤버 제거 가능 여부 체크
   */
  static canRemoveMember(
    currentUserRole: MemberRole | null | undefined,
    targetUserRole: MemberRole
  ): boolean {
    // owner만 멤버 제거 가능
    if (!this.isOwner(currentUserRole)) return false;

    // owner는 제거 불가
    if (targetUserRole === 'owner') return false;

    return true;
  }
}
