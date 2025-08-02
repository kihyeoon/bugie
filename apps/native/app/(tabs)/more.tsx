import { StyleSheet, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface MenuItem {
  title: string;
  icon: string;
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>더보기</Text>
      </View>

      <View style={[styles.menuSection, { backgroundColor: colors.background }]}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>{item.title}</Text>
            <IconSymbol
              name="chevron.right"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>
          버전 1.0.0
        </Text>
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
    borderRadius: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  footer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
});