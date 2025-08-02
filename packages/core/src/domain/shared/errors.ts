/**
 * 도메인 에러 기본 클래스
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

/**
 * 검증 에러
 */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 권한 에러
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string = '권한이 없습니다') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 엔티티를 찾을 수 없을 때 발생하는 에러
 */
export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity}을(를) 찾을 수 없습니다: ${id}` : `${entity}을(를) 찾을 수 없습니다`);
    this.name = 'NotFoundError';
  }
}

/**
 * 비즈니스 규칙 위반 에러
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}