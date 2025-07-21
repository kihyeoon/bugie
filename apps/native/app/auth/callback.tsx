import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // OAuth 콜백 처리는 Supabase가 자동으로 처리함
    // 이 화면은 로딩 표시용
    setTimeout(() => {
      router.replace('/');
    }, 1000);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#191919" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});