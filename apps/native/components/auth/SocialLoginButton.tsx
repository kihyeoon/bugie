import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
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
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: config.backgroundColor,
            borderColor: config.borderColor,
          },
          disabled && styles.buttonDisabled,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
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
      </Pressable>
    </Animated.View>
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
