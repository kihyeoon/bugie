import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { getIoniconName, DEFAULT_CATEGORY_COLOR } from '@/constants/categories';
import type { PaymentMethodEntity } from '@repo/core';

interface PaymentMethodItemProps {
  paymentMethod: PaymentMethodEntity;
  onPress?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  showDivider?: boolean;
}

export function PaymentMethodItem({
  paymentMethod,
  onPress,
  onDelete,
  canEdit,
  showDivider = false,
}: PaymentMethodItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      style={[
        styles.container,
        showDivider && styles.containerBorder,
        showDivider && { borderColor: colors.border },
      ]}
      onPress={canEdit ? onPress : undefined}
      onLongPress={canEdit ? onDelete : undefined}
      disabled={!canEdit}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: DEFAULT_CATEGORY_COLOR + '15' },
          ]}
        >
          <Ionicons
            name={getIoniconName(paymentMethod.icon)}
            size={20}
            color={DEFAULT_CATEGORY_COLOR}
          />
        </View>
        <View style={styles.textContainer}>
          <Typography variant="body1" numberOfLines={1}>{paymentMethod.name}</Typography>
        </View>
      </View>
      {canEdit && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textSecondary}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  containerBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
});
