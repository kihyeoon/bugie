import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router/react-navigation';
import { normalizeKeyword } from '@repo/core';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SearchInput } from '@/components/search/SearchInput';
import { SearchResults } from '@/components/search/SearchResults';
import { useLedger } from '@/contexts/LedgerContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  SEARCH_FETCH_LIMIT,
  useTransactionSearch,
} from '@/hooks/useTransactionSearch';

const DEBOUNCE_MS = 300;

/**
 * 거래 검색 — 현재 가계부의 전체 기간에서 제목·메모로 찾는다.
 * 설계: docs/features/search/design.md
 */
export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { currentLedger } = useLedger();

  const [input, setInput] = useState('');
  const normalizedInput = normalizeKeyword(input);
  const [keyword, flushKeyword] = useDebouncedValue(
    normalizedInput,
    DEBOUNCE_MS
  );
  const { results, sections, isPlaceholderData, loading, error, refetch } =
    useTransactionSearch(keyword);

  // 상세에서 수정·삭제하고 돌아오면 반영한다. 무효화는 표시만 하므로(refetchType: 'none') 직접 다시 받는다.
  // 검색어가 처음 생겨 refetch가 바뀌어도 useQueryStatus가 진행 중인 요청에 합류시켜 중복 요청은 없다.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // 키보드가 늘 떠 있어 상태 화면은 가운데가 아니라 위쪽에 둔다
  const renderState = (): ReactNode => {
    // 입력을 먼저 본다. 쿼리가 꺼져 있어도 placeholder로 이전 결과가 남아 있기 때문이다(설계 §6.5).
    if (normalizedInput === '' || keyword === '') {
      return (
        <StateText
          text={`${currentLedger?.name ?? '이 가계부'}의 모든 거래에서 찾아요`}
        />
      );
    }
    if (loading) return <LoadingState message="검색 중..." />;
    if (error) {
      return (
        <ErrorState
          message="검색 결과를 불러올 수 없습니다"
          onRetry={refetch}
        />
      );
    }
    // 이전 검색어의 결과를 보이는 중엔 판단하지 않는다. 결과가 오기 전에 "결과 없음"이 번쩍인다.
    if (results.length === 0 && !isPlaceholderData) {
      // 받침에 따라 조사가 바뀌므로 조사 없이 쓴다
      return <StateText text={`'${keyword}' 검색 결과가 없어요`} />;
    }
    return null;
  };
  const state = renderState();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        background={colors.background}
        center={
          <SearchInput
            value={input}
            onChangeText={setInput}
            onSubmit={flushKeyword}
          />
        }
      />
      <SafeAreaView style={styles.content} edges={['left', 'right', 'bottom']}>
        {state ? (
          // 자식의 flex: 1(LoadingState·ErrorState)이 늘어나지 않게 높이를 내용에 맞춘다 → 위쪽 정렬
          <View style={styles.stateArea}>{state}</View>
        ) : (
          <SearchResults
            sections={sections}
            count={results.length}
            keyword={keyword}
            isPlaceholderData={isPlaceholderData}
            isTruncated={results.length >= SEARCH_FETCH_LIMIT}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function StateText({ text }: { text: string }) {
  return (
    <Typography variant="body1" color="secondary" style={styles.stateText}>
      {text}
    </Typography>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  stateArea: {
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  stateText: {
    textAlign: 'center',
  },
});
