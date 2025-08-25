import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../ui';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ProfileRules } from '@repo/core';

interface EditNicknameModalProps {
  visible: boolean;
  currentNickname: string;
  onClose: () => void;
  onSave: (nickname: string) => Promise<void>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.5;

export function EditNicknameModal({
  visible,
  currentNickname,
  onClose,
  onSave,
}: EditNicknameModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  
  const [nickname, setNickname] = useState(currentNickname);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // 초기값 설정
  useEffect(() => {
    if (visible) {
      setNickname(currentNickname);
      setError(null);
      // 모달이 열릴 때 포커스
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, currentNickname]);

  // 애니메이션 처리
  useEffect(() => {
    if (visible) {
      // 열기 애니메이션
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  const validateNickname = (value: string): boolean => {
    try {
      ProfileRules.validateNickname(value);
      setError(null);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : '유효하지 않은 닉네임입니다.');
      return false;
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    
    // 닫기 애니메이션
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: MODAL_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose(); // 애니메이션 완료 후 호출
    });
  };

  const handleSave = async () => {
    if (!validateNickname(nickname)) {
      return;
    }

    if (nickname === currentNickname) {
      Alert.alert('알림', '기존 닉네임과 동일합니다.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(nickname.trim());
      handleClose();
    } catch {
      // 에러는 상위에서 처리
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeText = (text: string) => {
    setNickname(text);
    // 실시간 유효성 검사
    if (text.length > 0) {
      validateNickname(text);
    } else {
      setError(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* 어두운 배경 */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View 
            style={[
              styles.overlay,
              { opacity: opacityAnim }
            ]} 
          />
        </TouchableWithoutFeedback>

        {/* 모달 콘텐츠 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={0}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + 20,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* 헤더 */}
            <View style={styles.header}>
              <Typography variant="h3">닉네임 수정</Typography>
              <TouchableOpacity onPress={handleClose} disabled={isSaving}>
                <Typography variant="body1" color="secondary">
                  취소
                </Typography>
              </TouchableOpacity>
            </View>

            {/* 입력 필드 */}
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    borderColor: error ? colors.error : colors.border,
                  },
                ]}
                value={nickname}
                onChangeText={handleChangeText}
                placeholder="닉네임을 입력하세요"
                placeholderTextColor={colors.textSecondary}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              
              {error && (
                <Typography
                  variant="caption"
                  color="error"
                  style={styles.errorText}
                >
                  {error}
                </Typography>
              )}

              <Typography
                variant="caption"
                color="secondary"
                style={styles.helperText}
              >
                2-20자의 한글, 영문, 숫자, 공백만 사용 가능합니다.
              </Typography>
            </View>

            {/* 저장 버튼 */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.tint,
                  opacity: !nickname || !!error || isSaving ? 0.5 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={!nickname || !!error || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Typography 
                  variant="body1" 
                  weight="600" 
                  style={{ color: 'white' }}
                >
                  저장하기
                </Typography>
              )}
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: -0.3,
    borderWidth: 1,
  },
  errorText: {
    marginTop: 8,
    marginLeft: 4,
  },
  helperText: {
    marginTop: 8,
    marginLeft: 4,
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
});