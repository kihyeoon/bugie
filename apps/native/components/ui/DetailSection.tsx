import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from './Typography';
import { Card } from './Card';
import type { DetailRowProps } from './DetailRow';

export interface DetailSectionProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'card' | 'flat';
  spacing?: 'compact' | 'normal' | 'loose';
  style?: ViewStyle;
}

export function DetailSection({
  title,
  children,
  variant = 'card',
  spacing = 'normal',
  style,
}: DetailSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const spacingStyles = {
    compact: styles.spacingCompact,
    normal: styles.spacingNormal,
    loose: styles.spacingLoose,
  };

  const renderContent = () => {
    // children을 배열로 변환하여 마지막 아이템의 divider 제거
    const childrenArray = React.Children.toArray(children);

    return React.Children.map(childrenArray, (child, index) => {
      // DetailRow 컴포넌트인 경우 showDivider 자동 설정
      if (React.isValidElement<DetailRowProps>(child)) {
        const isLast = index === childrenArray.length - 1;
        // showDivider prop이 있는지 확인
        if ('showDivider' in child.props) {
          return React.cloneElement(child, {
            showDivider: !isLast,
          });
        }
      }
      return child;
    });
  };

  if (variant === 'flat') {
    return (
      <View style={[spacingStyles[spacing], style]}>
        {title && (
          <Typography variant="caption" color="secondary" style={styles.title}>
            {title}
          </Typography>
        )}
        <View
          style={[styles.flatContainer, { backgroundColor: colors.background }]}
        >
          {renderContent()}
        </View>
      </View>
    );
  }

  return (
    <View style={[spacingStyles[spacing], style]}>
      {title && (
        <Typography variant="caption" color="secondary" style={styles.title}>
          {title}
        </Typography>
      )}
      <Card variant="outlined" padding="none" style={styles.cardContainer}>
        {renderContent()}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  spacingCompact: {
    marginBottom: 16,
  },
  spacingNormal: {
    marginBottom: 24,
  },
  spacingLoose: {
    marginBottom: 32,
  },
  title: {
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cardContainer: {
    marginHorizontal: 16,
  },
  flatContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
