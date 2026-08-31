import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Alert,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useServices } from '@/contexts/ServiceContext';
import {
  ModalHeader,
  ModalHeaderButton,
} from '@/components/shared/ModalHeader';
import { formatInviteCode, buildInviteMessage } from '@/utils/invite';
import type { LedgerInviteEntity } from '@repo/core';

interface InviteCodeModalProps {
  visible: boolean;
  ledgerId: string;
  ledgerName: string;
  onClose: () => void;
}

function formatExpiry(expiresAt: Date): string {
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
  if (days <= 0) return '만료됨';
  return `${days}일 남음`;
}

function formatUseCount(invite: LedgerInviteEntity): string {
  return invite.maxUses
    ? `${invite.useCount}/${invite.maxUses}명 참여`
    : `${invite.useCount}명 참여`;
}

/**
 * 초대 코드 시트 (BGI-22)
 *
 * 이메일 대신 코드를 만들어 카톡 등으로 전달한다. 애플 로그인 사용자는 이메일이
 * Private Relay 주소라 상대가 알 수 없기 때문.
 *
 * 코드는 한 번에 하나만 쓴다. 열 때 활성 코드를 조회해서 있으면 그대로 보여주고
 * (만료·참여자·폐기 포함), 없을 때만 만들기 버튼을 노출한다.
 */
export function InviteCodeModal({
  visible,
  ledgerId,
  ledgerName,
  onClose,
}: InviteCodeModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { ledgerService } = useServices();

  const [invite, setInvite] = useState<LedgerInviteEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const fetchInvite = useCallback(async () => {
    try {
      const invites = await ledgerService.getInvites(ledgerId);
      // created_at desc 정렬이라 첫 활성 코드가 최신. 코드는 하나만 쓰는 스펙이라
      // 그 하나만 보여준다. (출시 전 테스트로 생긴 여분 활성 코드는 7일 내 자동 만료)
      setInvite(
        invites.find(
          (i) => i.status === 'active' && i.expiresAt.getTime() > Date.now()
        ) ?? null
      );
    } catch (error) {
      Alert.alert(
        '오류',
        error instanceof Error ? error.message : '초대 코드를 불러오지 못했습니다.'
      );
    }
  }, [ledgerService, ledgerId]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchInvite().finally(() => setLoading(false));
  }, [visible, fetchInvite]);

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await ledgerService.createInvite({ ledgerId });
      await fetchInvite();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '초대 코드를 만들지 못했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async (code: string) => {
    try {
      await Share.share({ message: buildInviteMessage(ledgerName, code) });
    } catch {
      // 공유 시트를 열지 못한 경우. 아래 '코드 복사' 버튼으로 안내한다.
      Alert.alert('공유할 수 없습니다', '아래 코드 복사를 이용해주세요.');
    }
  };

  const handleCopy = async (code: string) => {
    await Clipboard.setStringAsync(formatInviteCode(code));
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = (target: LedgerInviteEntity) => {
    Alert.alert(
      '초대 코드 폐기',
      `${formatInviteCode(target.code)} 코드를 폐기할까요?\n이미 참여한 멤버는 그대로 유지됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '폐기',
          style: 'destructive',
          onPress: async () => {
            try {
              await ledgerService.revokeInvite(target.id);
              await fetchInvite();
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ModalHeader
          title="초대 코드"
          left={
            <ModalHeaderButton
              label="닫기"
              onPress={handleClose}
              disabled={isCreating}
            />
          }
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {invite ? (
              <>
                {/* 활성 코드 */}
                <View
                  style={[
                    styles.codeBox,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Typography variant="h2" weight="700" style={styles.codeText}>
                    {formatInviteCode(invite.code)}
                  </Typography>
                  <Typography variant="caption" color="secondary">
                    {formatExpiry(invite.expiresAt)} · {formatUseCount(invite)}
                  </Typography>
                </View>

                {/* 공유 / 복사 */}
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                  onPress={() => handleShare(invite.code)}
                >
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Typography
                    variant="body1"
                    weight="600"
                    style={styles.primaryButtonText}
                  >
                    초대 코드 공유하기
                  </Typography>
                </Pressable>

                <Pressable
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                  onPress={() => handleCopy(invite.code)}
                >
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={copied ? colors.success : colors.text}
                  />
                  <Typography variant="body1" weight="600">
                    {copied ? '복사됨' : '코드 복사'}
                  </Typography>
                </Pressable>

                {/* 참여자 */}
                {invite.acceptances.length > 0 && (
                  <View style={styles.section}>
                    <Typography
                      variant="caption"
                      color="secondary"
                      style={styles.label}
                    >
                      이 코드로 참여
                    </Typography>
                    <Card variant="outlined" padding="medium" style={styles.card}>
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
                    </Card>
                  </View>
                )}

                <View style={styles.infoSection}>
                  <Typography
                    variant="caption"
                    color="secondary"
                    style={styles.infoText}
                  >
                    받은 사람이 앱에서 이 코드를 입력하면 가계부에 참여합니다.
                    {'\n'}
                    코드는 7일 후 자동으로 만료됩니다.
                  </Typography>
                </View>

                {/* 폐기 */}
                <Pressable
                  style={styles.revokeButton}
                  onPress={() => handleRevoke(invite)}
                >
                  <Typography variant="body2" weight="600" color="error">
                    코드 폐기
                  </Typography>
                </Pressable>

              </>
            ) : (
              <>
                {/* 활성 코드 없음 → 만들기 */}
                <View style={styles.infoSection}>
                  <Typography variant="body2" color="secondary">
                    상대의 이메일을 몰라도 초대할 수 있어요. 초대 코드를 만들어
                    원하는 방법으로 전달하세요.
                  </Typography>
                </View>

                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={isCreating}
                  onPress={handleCreate}
                >
                  초대 코드 만들기
                </Button>
              </>
            )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    gap: 12,
  },
  section: {
    marginTop: 8,
    gap: 8,
  },
  label: {
    textTransform: 'uppercase',
  },
  codeBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  codeText: {
    letterSpacing: 2,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  revokeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  card: {
    gap: 6,
  },
  acceptanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoSection: {
    marginTop: 4,
  },
  infoText: {
    lineHeight: 18,
  },
});
