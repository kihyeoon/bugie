import { memo, useCallback, useEffect, useRef } from 'react';
import { Keyboard, SectionList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  memoMatchSnippet,
  parseLocalDate,
  type TransactionWithDetails,
} from '@repo/core';
import { Typography } from '@/components/ui';
import { TransactionItem } from '@/components/transaction/TransactionItem';
import { DateSectionHeader } from '@/components/transaction/DateSectionHeader';
import type { GroupedTransaction } from '@/utils/groupByDate';

interface SearchResultsProps {
  sections: GroupedTransaction[];
  count: number;
  /** 결과를 받은 검색어. 메모 스니펫과 맨 위로 올리기에 쓴다 */
  keyword: string;
  /** 이전 검색어의 결과를 보이는 중 — 흐리게 그리고 개수는 숨긴다 */
  isPlaceholderData: boolean;
  /** 상한에 닿았으면 끝에 안내를 붙인다 */
  isTruncated: boolean;
}

const keyExtractor = (item: TransactionWithDetails) => item.id;

function openTransaction(transactionId: string) {
  // native-stack은 푸시할 때 키보드를 내리지 않는다
  Keyboard.dismiss();
  router.push({
    pathname: '/transaction-detail',
    params: { id: transactionId },
  });
}

/**
 * 검색 결과 목록. 입력칸 상태와 떼어 memo로 두어 글자를 칠 때마다 목록이 다시 그려지지 않게 한다.
 */
export const SearchResults = memo(function SearchResults({
  sections,
  count,
  keyword,
  isPlaceholderData,
  isTruncated,
}: SearchResultsProps) {
  const listRef =
    useRef<SectionList<TransactionWithDetails, { date: string }>>(null);

  // 새 검색어면 맨 위부터 보인다
  useEffect(() => {
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
  }, [keyword]);

  const renderTransaction = useCallback(
    ({ item }: { item: TransactionWithDetails }) => {
      const snippet = memoMatchSnippet(item, keyword);
      return (
        <TransactionItem
          transaction={item}
          onPress={openTransaction}
          subtitle={snippet ? `메모 · ${snippet}` : undefined}
        />
      );
    },
    [keyword]
  );

  const currentYear = new Date().getFullYear();
  const renderSectionHeader = useCallback(
    ({ section }: { section: GroupedTransaction }) => (
      <DateSectionHeader
        date={section.date}
        withYear={parseLocalDate(section.date).getFullYear() !== currentYear}
      />
    ),
    [currentYear]
  );

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      renderItem={renderTransaction}
      renderSectionHeader={renderSectionHeader}
      keyExtractor={keyExtractor}
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
            {`${count.toLocaleString()}건`}
          </Typography>
        )
      }
      ListFooterComponent={
        isTruncated ? (
          <Typography
            variant="caption"
            color="secondary"
            style={styles.limitNotice}
          >
            {`최근 ${count.toLocaleString()}건까지만 보여요`}
          </Typography>
        ) : null
      }
    />
  );
});

const styles = StyleSheet.create({
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
