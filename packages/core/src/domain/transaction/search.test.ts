import { describe, expect, it } from 'vitest';
import { memoMatchSnippet, normalizeKeyword } from './search';

describe('normalizeKeyword', () => {
  it('앞뒤 공백을 자른다', () => {
    expect(normalizeKeyword('  김밥 ')).toBe('김밥');
    expect(normalizeKeyword('\t김밥\n')).toBe('김밥');
  });

  it('공백뿐이면 빈 검색어', () => {
    expect(normalizeKeyword('   ')).toBe('');
  });

  // iOS 한글 키보드로 "김밥"을 칠 때 onChangeText로 들어오는 값 순서
  it.each([
    ['ㄱ', ''],
    ['기', '기'],
    ['김', '김'],
    ['김ㅂ', '김'],
    ['김바', '김바'],
    ['김밥', '김밥'],
  ])('입력 중 %s → %s', (input, expected) => {
    expect(normalizeKeyword(input)).toBe(expected);
  });

  it('끝에 붙은 낱자는 겹자음·모음까지 모두 뗀다', () => {
    expect(normalizeKeyword('김ㅄ')).toBe('김');
    expect(normalizeKeyword('김ㅂㅅ')).toBe('김');
    expect(normalizeKeyword('ㅏ')).toBe('');
  });

  it('낱자를 뗀 뒤 남은 공백도 자른다', () => {
    expect(normalizeKeyword('김밥 ㅂ')).toBe('김밥');
  });

  it('낱자로만 된 검색어는 빈 검색어', () => {
    expect(normalizeKeyword('ㅋㅋ')).toBe('');
  });

  it('중간의 낱자는 그대로 둔다', () => {
    expect(normalizeKeyword('ㅋㅋ웃김')).toBe('ㅋㅋ웃김');
  });
});

describe('memoMatchSnippet', () => {
  const tx = (
    title: string,
    description: string | null
  ): { title: string; description: string | null } => ({ title, description });

  it('제목에 검색어가 있으면 메모를 보이지 않는다', () => {
    expect(memoMatchSnippet(tx('아침 김밥', '김밥천국'), '김밥')).toBeNull();
  });

  it('제목·메모 어디에도 없으면 null', () => {
    expect(memoMatchSnippet(tx('편의점', '우유'), '김밥')).toBeNull();
    expect(memoMatchSnippet(tx('편의점', null), '김밥')).toBeNull();
  });

  it('빈 검색어는 null', () => {
    expect(memoMatchSnippet(tx('편의점', '삼각김밥'), '')).toBeNull();
  });

  it('메모 앞부분에서 걸리면 처음부터 보인다', () => {
    expect(memoMatchSnippet(tx('편의점', '삼각김밥, 우유'), '김밥')).toBe(
      '삼각김밥, 우유'
    );
  });

  it('메모 뒤쪽에서 걸리면 일치 위치 4자 앞부터 자르고 …를 붙인다', () => {
    expect(
      memoMatchSnippet(
        tx('장보기', '어제마트에서장보고돌아오는길삼각김밥'),
        '김밥'
      )
    ).toBe('…는길삼각김밥');
  });

  it('앞 4자 안에 공백이 있으면 공백 뒤부터 자른다', () => {
    expect(
      memoMatchSnippet(
        tx('장보기', '어제 마트에서 장보고 오는 길에 삼각김밥'),
        '김밥'
      )
    ).toBe('…삼각김밥');
  });

  it('대소문자를 무시하고 원문 표기를 보인다', () => {
    expect(
      memoMatchSnippet(tx('커피', 'Morning coffee at STARBUCKS'), 'starbucks')
    ).toBe('…STARBUCKS');
  });

  it('줄바꿈은 공백으로 바꾼다', () => {
    expect(memoMatchSnippet(tx('편의점', '우유\n김밥'), '김밥')).toBe(
      '우유 김밥'
    );
  });
});
