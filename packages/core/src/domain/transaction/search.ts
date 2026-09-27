/**
 * 거래 검색 규칙 (docs/features/search/design.md §4, §6.4)
 * DB 쪽 조건은 search_transactions RPC의 strpos(lower(...))다. 여기 판단도 같은 규칙(소문자 + 부분 일치)을 따른다.
 */

// 한글 호환 자모 ㄱ(U+3131) ~ ㅣ(U+3163). 끝에 붙어 있으면 조합이 덜 끝난 글자다.
const TRAILING_JAMO = /[ㄱ-ㅣ]+$/;

// 메모 스니펫에서 일치 위치 앞에 남길 글자 수. 두 번째 줄은 한글 18자 정도라 길면 검색어가 잘린다.
const SNIPPET_LEADING_CHARS = 4;

/**
 * 입력칸 값을 검색어로 정리한다. 빈 문자열이면 검색하지 않는다.
 * 끝의 낱자를 떼서 "김ㅂ"에서 멈췄을 때 "결과 없음"이 번쩍이지 않게 한다.
 * 완성 글자로 끝나는 조합 중간("김바")은 막지 못한다(설계 §4).
 */
export function normalizeKeyword(input: string): string {
  return input.trim().replace(TRAILING_JAMO, '').trim();
}

/**
 * 제목엔 없고 메모에서만 걸렸을 때, 메모에서 검색어가 보이는 부분을 돌려준다.
 * 그 밖에는 null — 호출하는 쪽이 카테고리 이름을 보인다.
 */
export function memoMatchSnippet(
  transaction: { title: string; description?: string | null },
  keyword: string
): string | null {
  const needle = keyword.toLowerCase();
  if (!needle || transaction.title.toLowerCase().includes(needle)) return null;

  const memo = (transaction.description ?? '').replace(/[\r\n]+/g, ' ');
  // 소문자로 바꾸면 길이가 달라지는 드문 문자(İ 등)는 위치가 어긋날 수 있다. 무시한다.
  const index = memo.toLowerCase().indexOf(needle);
  if (index === -1) return null;

  return snippetFrom(memo, index);
}

function snippetFrom(memo: string, matchIndex: number): string {
  if (matchIndex <= SNIPPET_LEADING_CHARS) return memo;

  // 단어 중간에서 시작하지 않게, 남길 구간에 공백이 있으면 그 뒤부터
  const windowStart = matchIndex - SNIPPET_LEADING_CHARS;
  const lastSpace = memo.slice(windowStart, matchIndex).lastIndexOf(' ');
  const start = lastSpace === -1 ? windowStart : windowStart + lastSpace + 1;

  return `…${memo.slice(start)}`;
}
