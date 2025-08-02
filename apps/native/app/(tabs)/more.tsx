import { StyleSheet, View, ScrollView } from 'react-native';
import { ComponentProps } from 'react';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography, ListItem, Card } from '@/components/ui';
import { IconSymbol } from '@/components/ui/IconSymbol';

type IconSymbolName = ComponentProps<typeof IconSymbol>['name'];

interface MenuItem {
  title: string;
  icon: IconSymbolName;
  onPress: () => void;
}

export default function MoreScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const menuItems: MenuItem[] = [
    {
      title: '전체 거래 내역',
      icon: 'list',
      onPress: () => {
        // TODO: 거래 목록 화면으로 이동
        console.log('거래 내역');
      },
    },
    {
      title: '가계부 관리',
      icon: 'folder',
      onPress: () => {
        // TODO: 가계부 관리 웹뷰로 이동
        console.log('가계부 관리');
      },
    },
    {
      title: '프로필 설정',
      icon: 'person',
      onPress: () => {
        // TODO: 프로필 설정 웹뷰로 이동
        console.log('프로필 설정');
      },
    },
    {
      title: '앱 설정',
      icon: 'settings',
      onPress: () => {
        // TODO: 앱 설정 화면으로 이동
        console.log('앱 설정');
      },
    },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { backgroundColor: colors.backgroundSecondary }]}>
        <Typography variant="h2">더보기</Typography>
      </View>

      <Card variant="filled" padding="none" style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <ListItem
            key={index}
            title={item.title}
            leftIcon={item.icon}
            onPress={item.onPress}
          />
        ))}
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
  footer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});