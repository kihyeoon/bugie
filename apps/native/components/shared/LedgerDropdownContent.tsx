import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import type { LedgerWithMembers } from '@repo/core';

interface LedgerDropdownContentProps {
  ledgers: LedgerWithMembers[];
  currentLedgerId: string | null;
  onSelectLedger: (ledgerId: string) => void;
  onCreateLedger: () => void;
  loading?: boolean;
  userId?: string;
}

export function LedgerDropdownContent({
  ledgers,
  currentLedgerId,
  onSelectLedger,
  onCreateLedger,
  loading = false,
  userId,
}: LedgerDropdownContentProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const getUserRole = (ledger: LedgerWithMembers) => {
    const member = ledger.ledger_members.find((m) => m.user_id === userId);
    if (!member) return null;

    switch (member.role) {
      case 'owner':
        return '소유자';
      case 'admin':
        return '관리자';
      case 'member':
        return '멤버';
      case 'viewer':
        return '열람자';
      default:
        return member.role;
    }
  };

  const getMemberCount = (ledger: LedgerWithMembers) => {
    return ledger.ledger_members.length;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="small" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Ledger List */}
      {ledgers.map((ledger, index) => {
        const isSelected = ledger.id === currentLedgerId;
        const role = getUserRole(ledger);
        const memberCount = getMemberCount(ledger);

        return (
          <Pressable
            key={ledger.id}
            onPress={() => onSelectLedger(ledger.id)}
            style={({ pressed }) => [
              styles.ledgerItem,
              pressed && styles.ledgerItemPressed,
              index !== 0 && styles.ledgerItemBorder,
              { borderColor: colors.border },
            ]}
          >
            {/* Check Icon */}
            <View style={styles.checkIconContainer}>
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.tint}
                />
              )}
            </View>

            {/* Ledger Info */}
            <View style={styles.ledgerInfo}>
              <Typography
                variant="body1"
                weight={isSelected ? '600' : '500'}
                numberOfLines={1}
              >
                {ledger.name}
              </Typography>
              {role && memberCount && (
                <Typography
                  variant="caption"
                  color="secondary"
                  numberOfLines={1}
                >
                  {role} · 멤버 {memberCount}명
                </Typography>
              )}
            </View>
          </Pressable>
        );
      })}

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Create New Ledger Button */}
      <Pressable
        onPress={onCreateLedger}
        style={({ pressed }) => [
          styles.createButton,
          pressed && styles.createButtonPressed,
        ]}
      >
        <Ionicons
          name="add-circle-outline"
          size={20}
          color={colors.tint}
          style={styles.createIcon}
        />
        <Typography variant="body1" color="primary">
          새 가계부 만들기
        </Typography>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  ledgerItemPressed: {
    opacity: 0.7,
  },
  ledgerItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkIconContainer: {
    width: 20,
    height: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerInfo: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  createButtonPressed: {
    opacity: 0.7,
  },
  createIcon: {
    marginRight: 12,
  },
});