import React, { useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';
import { formatInviteCode, buildInviteMessage } from '@/utils/invite';

interface InviteLinkModalProps {
  visible: boolean;
  ledgerName: string;
  /** 초대 코드를 발급해 반환한다 */
  onCreateCode: () => Promise<string>;
  onClose: () => void;
}

/**
 * 초대 링크(코드) 생성·공유 모달
 *
 * 이메일 대신 코드를 만들어 카톡 등으로 전달한다. 애플 로그인 사용자는 이메일이
 * Private Relay 주소라 상대가 알 수 없기 때문(BGI-22).
 */
export function InviteLinkModal({
  visible,
  ledgerName,
  onCreateCode,
  onClose,
}: InviteLinkModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [code, setCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setCode(null);
    setCopied(false);
    onClose();
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const newCode = await onCreateCode();
      setCode(newCode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '초대 코드를 만들지 못했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: buildInviteMessage(ledgerName, code) });
    } catch {
      // 공유 시트를 열지 못하면 복사로 대체
      await handleCopy();
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(formatInviteCode(code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* 드래그 핸들 */}
        <View style={styles.dragHandle} />

        {/* 헤더 */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} disabled={isCreating}>
            <Typography variant="body1" color="primary">
              닫기
            </Typography>
          </Pressable>
          <Typography variant="h3" weight="600">
            초대 링크
          </Typography>
          {/* 헤더 3분할 유지를 위한 자리 */}
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {code ? (
            <>
              {/* 발급된 코드 */}
              <View style={styles.section}>
                <Typography
                  variant="caption"
                  color="secondary"
                  style={styles.label}
                >
                  초대 코드
                </Typography>
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
                    {formatInviteCode(code)}
                  </Typography>
                </View>
              </View>

              {/* 공유 / 복사 */}
              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Typography
                  variant="body1"
                  weight="600"
                  style={styles.primaryButtonText}
                >
                  카톡·메시지로 보내기
                </Typography>
              </Pressable>

              <Pressable
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.border },
                ]}
                onPress={handleCopy}
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

              <View style={styles.infoSection}>
                <Typography
                  variant="caption"
                  color="secondary"
                  style={styles.infoText}
                >
                  받은 사람이 앱에서 이 코드를 입력하면 가계부에 참여합니다.
                  {'\n'}
                  링크는 7일 후 만료되며, 설정에서 언제든 폐기할 수 있습니다.
                </Typography>
              </View>
            </>
          ) : (
            <>
              {/* 생성 전 안내 */}
              <View style={styles.infoSection}>
                <Typography variant="body2" color="secondary">
                  상대의 이메일을 몰라도 초대할 수 있어요. 초대 코드를 만들어
                  카톡이나 메시지로 전달하세요.
                </Typography>
              </View>

              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
                onPress={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Typography
                    variant="body1"
                    weight="600"
                    style={styles.primaryButtonText}
                  >
                    초대 코드 만들기
                  </Typography>
                )}
              </Pressable>
            </>
          )}
        </View>
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
  content: {
    padding: 20,
    gap: 12,
  },
  section: {
    marginBottom: 8,
  },
  label: {
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  codeBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 20,
    alignItems: 'center',
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
  infoSection: {
    marginTop: 4,
  },
  infoText: {
    lineHeight: 18,
  },
});
