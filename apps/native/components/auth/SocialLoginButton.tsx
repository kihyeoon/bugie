import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OAuthProvider } from '@repo/types';

interface SocialLoginButtonProps {
  provider: OAuthProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const providerConfig = {
  google: {
    text: 'Google로 시작하기',
    backgroundColor: '#FFFFFF',
    textColor: '#191919',
    borderColor: '#E5E5E5',
    icon: 'logo-google' as const,
    iconColor: '#4285F4',
  },
  apple: {
    text: 'Apple로 시작하기',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
    borderColor: '#000000',
    icon: 'logo-apple' as const,
    iconColor: '#FFFFFF',
  },
  kakao: {
    text: '카카오로 시작하기',
    backgroundColor: '#FEE500',
    textColor: '#191919',
    borderColor: '#FEE500',
    icon: 'chatbubble' as const,
    iconColor: '#000000',
  },
};

export function SocialLoginButton({
  provider,
  onPress,
  loading = false,
  disabled = false,
}: SocialLoginButtonProps) {
  const config = providerConfig[provider];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <View style={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={config.textColor}
            style={styles.loader}
          />
        ) : (
          <Ionicons
            name={config.icon}
            size={20}
            color={config.iconColor}
            style={styles.icon}
          />
        )}
        <Text style={[styles.text, { color: config.textColor }]}>
          {config.text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 12,
  },
  loader: {
    marginRight: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
});