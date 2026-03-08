import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { getIoniconName } from '@/constants/categories';
import type { PaymentMethodEntity } from '@repo/core';

interface PaymentMethodItemProps {
  paymentMethod: PaymentMethodEntity;
  isCurrentUser: boolean;
  onPress?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
}

export function PaymentMethodItem({
  paymentMethod,
  isCurrentUser,
  onPress,
  onDelete,
  canEdit,
}: PaymentMethodItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.background }]}
      onPress={canEdit ? onPress : undefined}
      onLongPress={canEdit ? onDelete : undefined}
      disabled={!canEdit}
    >
      <View style={styles.left}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}
        >
          <Ionicons
            name={getIoniconName(paymentMethod.icon)}
            size={20}
            color={colors.tint}
          />
        </View>
        <View style={styles.textContainer}>
          <Typography variant="body1">{paymentMethod.name}</Typography>
        </View>
        {paymentMethod.isShared && (
          <View
            style={[styles.badge, { backgroundColor: colors.tint + '15' }]}
          >
            <Typography
              variant="caption"
              style={{ color: colors.tint, fontWeight: '700' }}
            >
              공동
            </Typography>
          </View>
        )}
        {!paymentMethod.isShared && isCurrentUser && (
          <View
            style={[styles.badge, { backgroundColor: colors.tint + '15' }]}
          >
            <Typography
              variant="caption"
              style={{ color: colors.tint, fontWeight: '700' }}
            >
              나
            </Typography>
          </View>
        )}
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
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
