import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLedger } from '@/contexts/LedgerContext';

export function LedgerSelector() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { currentLedger, ledgers } = useLedger();

  if (!currentLedger || ledgers.length <= 1) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => {
        // TODO: Show ledger selection modal
        console.log('Show ledger selector');
      }}
    >
      <Text
        style={[styles.ledgerName, { color: colors.text }]}
        numberOfLines={1}
      >
        {currentLedger.name}
      </Text>
      <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  ledgerName: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.3,
    maxWidth: 200,
  },
});
