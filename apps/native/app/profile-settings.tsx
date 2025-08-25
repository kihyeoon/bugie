import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, Card, ListItem } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import { EditTextModal } from '@/components/shared/EditTextModal';
import { DeleteAccountModal } from '@/components/profile/DeleteAccountModal';
import { ProfileRules } from '@repo/core';
import type { ProfileDetail } from '@repo/core';

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
  const handleDeleteAccount = async () => {
    try {
      await profileService.deleteAccount({
        userId: user?.id || '',
        confirmText: '정말 탈퇴하시겠습니까?',
      });

      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : '회원 탈퇴 중 오류가 발생했습니다.';
      Alert.alert('탈퇴 실패', errorMessage);
    }
  };

  // 이니셜 생성
  const getInitials = () => {
    const name = profile?.full_name || profile?.email || '?';
    return name.substring(0, 2).toUpperCase();
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Stack.Screen
          options={{
            title: '프로필 설정',
            headerShadowVisible: false,
            headerLeft: () => (
              <Pressable onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
            ),
          }}
        />
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '프로필 설정',
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={[
          styles.container,
          { backgroundColor: colors.backgroundSecondary },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 헤더 */}
        <View
          style={[styles.profileHeader, { backgroundColor: colors.background }]}
        >
          <View style={[styles.profileImage, { backgroundColor: colors.tint }]}>
            <Typography variant="h2" style={{ color: '#FFFFFF' }}>
              {getInitials()}
            </Typography>
          </View>
          <Typography variant="h3" style={styles.profileName}>
            {profile?.full_name || '이름 없음'}
          </Typography>
          <Typography variant="body1" color="secondary">
            {profile?.email}
          </Typography>
        </View>

        {/* 프로필 정보 섹션 */}
        <Card variant="outlined" padding="none" style={styles.section}>
          <View style={{ opacity: isUpdating ? 0.6 : 1 }}>
            <ListItem
              title="닉네임"
              rightText={profile?.full_name || '설정하기'}
              onPress={() => setNicknameModalVisible(true)}
              disabled={isUpdating}
            />
          </View>
          <ListItem
            title="이메일"
            rightText={profile?.email || ''}
            disabled
            style={{ opacity: 0.7 }}
          />
        </Card>

        {/* 가계부 정보 섹션 */}
        {profileDetail && (
          <Card variant="outlined" padding="none" style={styles.section}>
            <ListItem
              title="소유한 가계부"
              rightText={`${profileDetail.ownedLedgerCount || 0}개`}
              disabled
            />
            <ListItem
              title="참여 중인 가계부"
              rightText={`${profileDetail.sharedLedgerCount || 0}개`}
              disabled
            />
          </Card>
        )}

        {/* 계정 관리 섹션 */}
        <Card variant="outlined" padding="none" style={styles.section}>
          <ListItem
            title="회원 탈퇴"
            variant="danger"
            onPress={() => setDeleteAccountModalVisible(true)}
          />
        </Card>

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
        validate={(text) => {
          try {
            ProfileRules.validateNickname(text);
            return null;
          } catch (error) {
            return error instanceof Error
              ? error.message
              : '유효하지 않은 닉네임입니다.';
          }
        }}
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
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    marginBottom: 8,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  footer: {
    height: 40,
  },
});
