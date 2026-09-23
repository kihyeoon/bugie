import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, DetailRow, DetailSection } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { EditTextModal } from '@/components/shared/EditTextModal';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { DELETE_ACCOUNT } from '@repo/core';
import { nicknameError } from '@/services/auth/profileService';
import type { ProfileDetail } from '@repo/core';
import { ScreenHeader } from '@/components/shared/ScreenHeader';
import * as Clipboard from 'expo-clipboard';

export default function ProfileSettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { user, profile, updateProfile, signOut } = useAuth();
  const { profileService } = useServices();

  const [profileDetail, setProfileDetail] = useState<ProfileDetail | null>(
    null
  );
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] =
    useState(false);

  // 프로필 상세 정보 조회
  const fetchProfileDetail = useCallback(
    async (isInitial = false) => {
      if (!user) return;

      try {
        if (isInitial) {
          setInitialLoading(true);
        }
        const detail = await profileService.getCurrentProfile();
        setProfileDetail(detail);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        if (isInitial) {
          Alert.alert('오류', '프로필 정보를 불러올 수 없습니다.');
        }
      } finally {
        if (isInitial) {
          setInitialLoading(false);
        }
      }
    },
    [user, profileService]
  );

  useEffect(() => {
    fetchProfileDetail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면 포커스 시 프로필 새로고침 (초기 로딩이 아닌 경우)
  useFocusEffect(
    useCallback(() => {
      if (!initialLoading) {
        fetchProfileDetail(false);
      }
    }, [initialLoading, fetchProfileDetail])
  );

  // 닉네임 수정 처리 (소프트 업데이트)
  const handleNicknameUpdate = async (newNickname: string) => {
    setIsUpdating(true);
    try {
      // 낙관적 업데이트 - UI 즉시 반영
      await updateProfile({ full_name: newNickname });
      // 백그라운드에서 프로필 상세 정보 동기화
      fetchProfileDetail(false);
    } catch (error) {
      console.error('Failed to update nickname:', error);
      Alert.alert('오류', '닉네임 변경에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  // 회원 탈퇴 처리
  // 애플 로그인은 이메일이 Private Relay 주소라 화면에서 잘려 보이고 외우기도 어렵다.
  // 가계부 주인에게 전달해 초대받을 수 있도록 복사/공유 수단을 준다(BGI-22).
  const handleEmailPress = () => {
    const email = profile?.email;
    if (!email) return;

    Alert.alert('내 이메일', email, [
      { text: '취소', style: 'cancel' },
      {
        text: '복사',
        onPress: async () => {
          await Clipboard.setStringAsync(email);
          Alert.alert('복사됨', '이메일을 복사했습니다.');
        },
      },
      {
        text: '공유',
        onPress: () => {
          Share.share({
            message: `제 Bugie 계정 이메일이에요.\n${email}`,
          }).catch(() => undefined);
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    try {
      await profileService.deleteAccount({
        userId: user?.id || '',
        confirmText: DELETE_ACCOUNT.CONFIRM_TEXT,
      });

      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : DELETE_ACCOUNT.ERRORS.GENERIC;
      Alert.alert('탈퇴 실패', errorMessage);
    }
  };

  // 이니셜 생성
  const getInitials = () => {
    const name = profile?.full_name || profile?.email || '?';
    return name.substring(0, 2).toUpperCase();
  };

  // 분기별 본문을 동일 래퍼로 감싸 헤더를 화면당 1회만 합성.
  const renderScreen = (body: React.ReactNode) => (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
    >
      <ScreenHeader
        title="프로필 설정"
        background={colors.backgroundSecondary}
      />
      {body}
    </View>
  );

  if (initialLoading) {
    return renderScreen(
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return renderScreen(
    <>
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 사진 */}
        <View
          style={[
            styles.profileHeader,
            { backgroundColor: colors.backgroundSecondary },
          ]}
        >
          <View style={[styles.profileImage, { backgroundColor: colors.tint }]}>
            <Typography variant="h2" style={{ color: '#FFFFFF' }}>
              {getInitials()}
            </Typography>
          </View>
        </View>

        {/* 프로필 정보 섹션 */}
        <DetailSection title="프로필 정보">
          <DetailRow
            label="닉네임"
            value={profile?.full_name || '설정하기'}
            editable={true}
            actionable={true}
            onPress={() => setNicknameModalVisible(true)}
            disabled={isUpdating}
            loading={isUpdating}
          />
          <DetailRow
            label="이메일"
            value={profile?.email || ''}
            editable={true}
            actionable={true}
            onPress={handleEmailPress}
            numberOfLines={1}
          />
        </DetailSection>

        {/* 가계부 정보 섹션 */}
        {profileDetail && (
          <DetailSection title="가계부 정보">
            <DetailRow
              label="소유한 가계부"
              value={`${profileDetail.ownedLedgerCount || 0}개`}
              editable={false}
              rightIcon={false}
            />
            <DetailRow
              label="참여 중인 가계부"
              value={`${profileDetail.sharedLedgerCount || 0}개`}
              editable={false}
              rightIcon={false}
            />
          </DetailSection>
        )}

        {/* 계정 관리 섹션 */}
        <DetailSection title="계정 관리">
          <DetailRow
            label="회원 탈퇴"
            variant="danger"
            actionable={true}
            onPress={() => setDeleteAccountModalVisible(true)}
          />
        </DetailSection>

        <View style={styles.footer} />
      </ScrollView>

      {/* 닉네임 수정 모달 */}
      <EditTextModal
        visible={nicknameModalVisible}
        title="닉네임 수정"
        initialValue={profile?.full_name || ''}
        placeholder="닉네임을 입력하세요"
        maxLength={20}
        helperText="2-20자의 한글, 영문, 숫자, 공백만 사용 가능합니다."
        validate={nicknameError}
        validateOnChange={true}
        required={true}
        autoCapitalize="none"
        autoCorrect={false}
        onSave={handleNicknameUpdate}
        onClose={() => setNicknameModalVisible(false)}
      />

      {/* 회원 탈퇴 확인 모달 */}
      <DeleteAccountModal
        visible={deleteAccountModalVisible}
        ownedLedgerCount={profileDetail?.ownedLedgerCount || 0}
        ownedLedgersWithOtherMembers={
          profileDetail?.ownedLedgersWithOtherMembers || 0
        }
        onClose={() => setDeleteAccountModalVisible(false)}
        onConfirm={handleDeleteAccount}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    height: 40,
  },
});
