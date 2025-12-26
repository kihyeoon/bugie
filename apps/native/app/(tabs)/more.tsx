import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ComponentProps } from 'react';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, ListItem, Card } from '@/components/ui';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

type IconSymbolName = ComponentProps<typeof IconSymbol>['name'];

interface MenuItem {
  title: string;
  icon: IconSymbolName;
  onPress: () => void;
}

export default function MoreScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      {
        text: '취소',
        style: 'cancel',
      },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (error) {
            console.error('로그아웃 실패:', error);
            Alert.alert('오류', '로그아웃 중 문제가 발생했습니다.');
          }
        },
      },
    ]);
  };

  const handleOpenURL = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('오류', '링크를 열 수 없습니다.');
    }
  };

  const menuItems: MenuItem[] = [
    {
      title: '가계부 관리',
      icon: 'folder.fill',
      onPress: () => {
        router.push('/ledger-management');
      },
    },
    {
      title: '프로필 설정',
      icon: 'person.fill',
      onPress: () => {
        router.push('/profile-settings');
      },
    },
    // 앱 설정은 Phase 2에서 구현 예정 (푸시 알림, 캐시 관리 등)
  ];

  const policyItems: MenuItem[] = [
    {
      title: '개인정보 처리방침',
      icon: 'lock.shield.fill',
      onPress: () =>
        handleOpenURL(
          'https://imkion.notion.site/2d5e1b1c6cbb80a4a6efe15714c1aa80'
        ),
    },
    {
      title: '서비스 이용약관',
      icon: 'doc.text.fill',
      onPress: () =>
        handleOpenURL(
          'https://imkion.notion.site/2d5e1b1c6cbb809caa06e73a5095042b'
        ),
    },
  ];

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colors.backgroundSecondary },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[styles.header, { backgroundColor: colors.backgroundSecondary }]}
      >
        <Typography variant="h2">더보기</Typography>
      </View>

      <Card variant="outlined" padding="none" style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <ListItem
            key={index}
            title={item.title}
            leftIcon={item.icon}
            onPress={item.onPress}
          />
        ))}
      </Card>

      <Card variant="outlined" padding="none" style={styles.policySection}>
        {policyItems.map((item, index) => (
          <ListItem
            key={index}
            title={item.title}
            leftIcon={item.icon}
            onPress={item.onPress}
          />
        ))}
      </Card>

      <Card variant="outlined" padding="none" style={styles.signOutSection}>
        <ListItem
          title="로그아웃"
          leftIcon="rectangle.portrait.and.arrow.right"
          onPress={handleSignOut}
          variant="danger"
        />
      </Card>

      <View style={styles.footer}>
        <Typography variant="caption" color="secondary">
          버전 1.0.0
        </Typography>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  menuSection: {
    marginHorizontal: 16,
  },
  policySection: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  signOutSection: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  footer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
