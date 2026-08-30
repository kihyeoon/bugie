import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/contexts/ServiceContext';
import { formatInviteCode } from '@/utils/invite';
import type { LedgerInviteEntity } from '@repo/core';

interface ManageInvitesModalProps {
  visible: boolean;
  ledgerId: string;
  onClose: () => void;
}

function formatExpiry(expiresAt: Date): string {
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
  if (days <= 0) return '만료됨';
  return `${days}일 남음`;
}

/**
 * 초대 링크 관리 (BGI-22)
 *
 * 활성 링크와 그 링크로 들어온 사람을 보여주고, 링크를 폐기한다.
 */
export function ManageInvitesModal({
  visible,
  ledgerId,
  onClose,
}: ManageInvitesModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { ledgerService } = useServices();

  const [invites, setInvites] = useState<LedgerInviteEntity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await ledgerService.getInvites(ledgerId));
    } catch (error) {
      Alert.alert(
        '오류',
        error instanceof Error ? error.message : '초대 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, [ledgerService, ledgerId]);

  useEffect(() => {
    if (visible) fetchInvites();
  }, [visible, fetchInvites]);

  const handleRevoke = (invite: LedgerInviteEntity) => {
    Alert.alert(
      '초대 링크 폐기',
      `${formatInviteCode(invite.code)} 링크를 폐기할까요?\n이미 참여한 멤버는 그대로 유지됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '폐기',
          style: 'destructive',
          onPress: async () => {
            try {
              await ledgerService.revokeInvite(invite.id);
              await fetchInvites();
            } catch (error) {
              Alert.alert(
                '오류',
                error instanceof Error ? error.message : '폐기하지 못했습니다.'
              );
            }
          },
        },
      ]
    );
  };

  const activeInvites = invites.filter(
    (i) => i.status === 'active' && i.expiresAt.getTime() > Date.now()
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.dragHandle} />

        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose}>
            <Typography variant="body1" color="primary">
              닫기
            </Typography>
          </Pressable>
          <Typography variant="h3" weight="600">
            초대 관리
          </Typography>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : activeInvites.length === 0 ? (
          <View style={styles.center}>
            <Ionicons
              name="ticket-outline"
              size={48}
              color={colors.textDisabled}
            />
            <Typography variant="body1" color="secondary" align="center">
              활성 초대 링크가 없습니다
            </Typography>
            <Typography variant="caption" color="secondary" align="center">
              멤버 관리에서 초대 링크를 만들어보세요.
            </Typography>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {activeInvites.map((invite) => (
              <Card
                key={invite.id}
                variant="outlined"
                padding="medium"
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <Typography variant="body1" weight="700">
                    {formatInviteCode(invite.code)}
                  </Typography>
                  <Pressable onPress={() => handleRevoke(invite)} hitSlop={8}>
                    <Typography variant="caption" weight="600" color="error">
                      폐기
                    </Typography>
                  </Pressable>
                </View>

                <Typography variant="caption" color="secondary">
                  {formatExpiry(invite.expiresAt)} ·{' '}
                  {invite.maxUses
                    ? `${invite.useCount}/${invite.maxUses}명 참여`
                    : `${invite.useCount}명 참여`}
                </Typography>

                {invite.acceptances.length > 0 && (
                  <View
                    style={[
                      styles.acceptances,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    {invite.acceptances.map((a) => (
                      <View key={a.userId} style={styles.acceptanceRow}>
                        <Ionicons
                          name="person-circle-outline"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Typography variant="caption" color="secondary">
                          {a.fullName ?? '이름 없음'}
                        </Typography>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSpacer: {
    width: 36,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  acceptances: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  acceptanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
