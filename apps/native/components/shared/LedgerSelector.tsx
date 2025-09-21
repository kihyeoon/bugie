import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLedger } from '@/contexts/LedgerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Typography } from '@/components/ui/Typography';
import { Dropdown } from '@/components/ui/Dropdown';
import { LedgerDropdownContent } from './LedgerDropdownContent';
import { CreateLedgerModal } from '@/components/ledger/CreateLedgerModal';

export function LedgerSelector() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { currentLedger, ledgers, selectLedger, refreshLedgers } = useLedger();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Define all hooks before any conditional returns (Rules of Hooks)
  const handleSelectLedger = useCallback(
    async (ledgerId: string) => {
      if (ledgerId !== currentLedger?.id) {
        await selectLedger(ledgerId);
      }
      setIsOpen(false);
    },
    [currentLedger?.id, selectLedger]
  );

  const handleCreateLedger = useCallback(() => {
    setIsOpen(false);
    setShowCreateModal(true);
  }, []);

  const handleCreateSuccess = useCallback(
    async (ledgerId: string) => {
      await refreshLedgers();
      await selectLedger(ledgerId);
      setShowCreateModal(false);
    },
    [refreshLedgers, selectLedger]
  );

  // Show selector even with single ledger for consistency
  if (!currentLedger) {
    return null;
  }

  const trigger = (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
        pressed && styles.containerPressed,
      ]}
    >
      <View style={styles.content}>
        <Typography
          variant="body1"
          weight="600"
          numberOfLines={1}
          style={styles.ledgerName}
        >
          {currentLedger.name}
        </Typography>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </View>
    </Pressable>
  );

  return (
    <>
      <Dropdown
        trigger={trigger}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        maxHeight={320}
        minWidth={200}
        maxWidth={260}
        alignment="left"
        offset={0}
      >
        <LedgerDropdownContent
          ledgers={ledgers}
          currentLedgerId={currentLedger.id}
          onSelectLedger={handleSelectLedger}
          onCreateLedger={handleCreateLedger}
          userId={user?.id}
        />
      </Dropdown>

      <CreateLedgerModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  containerPressed: {
    opacity: 0.8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  ledgerName: {
    // No additional styles needed
  },
});
