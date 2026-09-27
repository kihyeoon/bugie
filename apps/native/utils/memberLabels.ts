/**
 * paid_by 라벨. 같은 컬럼이 지출에선 돈을 쓴 사람, 수입에선 받은 사람이다.
 * "쓴 사람"은 바로 아래 "작성자" 행과 같은 뜻으로 읽혀서 쓰지 않는다.
 */
export function paidByLabel(type: 'income' | 'expense'): string {
  return type === 'income' ? '받은 사람' : '지출한 사람';
}

/** 닉네임이 비어 있는 멤버의 표시 이름 */
export function memberName(member: { full_name: string | null }): string {
  return member.full_name || '멤버';
}
