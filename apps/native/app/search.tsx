import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import {
  memoMatchSnippet,
  normalizeKeyword,
  parseLocalDate,
  type TransactionWithDetails,
} from '@repo/core';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SearchInput } from '@/components/search/SearchInput';
import { TransactionItem } from '@/components/transaction/TransactionItem';
import { DateSectionHeader } from '@/components/transaction/DateSectionHeader';
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
  // refetch 정체성이 바뀔 때마다 포커스 효과가 다시 돌지 않게 ref로 넘긴다.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);
  useFocusEffect(
    useCallback(() => {
      refetchRef.current();
    }, [])
  );

  const handleTransactionPress = useCallback((transactionId: string) => {
    // native-stack은 푸시할 때 키보드를 내리지 않는다
    Keyboard.dismiss();
    router.push({
      pathname: '/transaction-detail',
      params: { id: transactionId },
    });
  }, []);

  const renderTransaction = useCallback(
    ({ item }: { item: TransactionWithDetails }) => {
      const snippet = memoMatchSnippet(item, keyword);
      return (
        <TransactionItem
          transaction={item}
          onPress={handleTransactionPress}
          subtitle={snippet ? `메모 · ${snippet}` : undefined}
        />
      );
    },
    [keyword, handleTransactionPress]
  );

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: SectionListData<TransactionWithDetails, { date: string }>;
    }) => (
      <DateSectionHeader
        date={section.date}
        withYear={
          parseLocalDate(section.date).getFullYear() !==
          new Date().getFullYear()
        }
      />
    ),
    []
  );

  const renderBody = () => {
    // 입력을 먼저 본다. 쿼리가 꺼져 있어도 placeholder로 이전 결과가 남아 있기 때문이다(설계 §6.5).
    if (normalizedInput === '' || keyword === '') {
      return (
        <StateMessage
          text={`${currentLedger?.name ?? '이 가계부'}의 모든 거래에서 찾아요`}
        />
      );
    }
    if (loading) {
      return (
        <View style={styles.stateArea}>
          <LoadingState message="검색 중..." />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.stateArea}>
          <ErrorState
            message="검색 결과를 불러올 수 없습니다"
            onRetry={refetch}
          />
        </View>
      );
    }
    // 이전 검색어의 결과를 보이는 중엔 판단하지 않는다. 결과가 오기 전에 "결과 없음"이 번쩍인다.
    if (results.length === 0 && !isPlaceholderData) {
      // 받침에 따라 조사가 바뀌므로 조사 없이 쓴다
      return <StateMessage text={`'${keyword}' 검색 결과가 없어요`} />;
    }

    return (
      <SectionList
        // 새 검색어면 맨 위부터 보인다
        key={keyword}
        sections={sections}
        renderItem={renderTransaction}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        style={isPlaceholderData && styles.stale}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        ListHeaderComponent={
          isPlaceholderData ? null : (
            <Typography variant="body2" color="secondary" style={styles.count}>
              {`${results.length.toLocaleString()}건`}
            </Typography>
          )
        }
        ListFooterComponent={
          results.length >= SEARCH_FETCH_LIMIT ? (
            <Typography
              variant="caption"
              color="secondary"
              style={styles.limitNotice}
            >
              {`최근 ${SEARCH_FETCH_LIMIT.toLocaleString()}건까지만 보여요`}
            </Typography>
          ) : null
        }
      />
    );
  };

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
        {renderBody()}
      </SafeAreaView>
    </View>
  );
}

/** 안내·결과 없음 문구. 키보드가 늘 떠 있어 가운데가 아니라 위쪽에 둔다. */
function StateMessage({ text }: { text: string }) {
  return (
    <View style={styles.stateArea}>
      <Typography variant="body1" color="secondary" style={styles.stateText}>
        {text}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  // 자식의 flex: 1(LoadingState·ErrorState)이 늘어나지 않게 높이를 내용에 맞춘다 → 위쪽 정렬
  stateArea: {
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  stateText: {
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  stale: {
    opacity: 0.5,
  },
  count: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  limitNotice: {
    textAlign: 'center',
    paddingVertical: 16,
  },
});
