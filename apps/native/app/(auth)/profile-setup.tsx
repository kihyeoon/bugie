import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';

export default function ProfileSetupScreen() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      await updateProfile({
        full_name: fullName.trim(),
      });
      
      // 프로필 설정 완료 후 홈으로 이동
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('오류', '프로필 설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>프로필 설정</Text>
          <Text style={styles.subtitle}>
            Bugie 사용을 위해 프로필을 설정해주세요
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>이름</Text>
          <TextInput
            style={styles.input}
            placeholder="이름을 입력하세요"
            value={fullName}
            onChangeText={setFullName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveProfile}
          />
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '저장 중...' : '시작하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    flex: 0.3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#191919',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8B8B8B',
    textAlign: 'center',
  },
  formSection: {
    flex: 0.4,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#191919',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  buttonSection: {
    flex: 0.3,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  button: {
    height: 56,
    backgroundColor: '#191919',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});