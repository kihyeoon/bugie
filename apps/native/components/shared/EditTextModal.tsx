import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  KeyboardTypeOptions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Typography } from '@/components/ui/Typography';

interface EditTextModalProps {
  visible: boolean;
  title: string;
  initialValue: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;

  // 확장된 기능
  validate?: (text: string) => string | null;
  helperText?: string;
  validateOnChange?: boolean;
  required?: boolean;
  showCharCount?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: KeyboardTypeOptions;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.4;

export function EditTextModal({
  visible,
  title,
  initialValue,
  placeholder = '',
  maxLength = 100,
  multiline = false,
  onSave,
  onClose,
  validate,
  helperText,
  validateOnChange = false,
  required = false,
  showCharCount,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  keyboardType = 'default',
}: EditTextModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // showCharCount 기본값 설정
  const shouldShowCharCount =
    showCharCount ?? (maxLength !== undefined && maxLength < 200);

  // 초기값 설정
  useEffect(() => {
    if (visible) {
      setText(initialValue || '');
      setError(null);
      // 모달과 키보드가 동시에 올라오도록 즉시 포커스
      inputRef.current?.focus();
    }
  }, [visible, initialValue]);

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

  const validateText = (value: string): boolean => {
    if (!validate) return true;

    const errorMessage = validate(value);
    setError(errorMessage);
    return !errorMessage;
  };

  const handleChangeText = (value: string) => {
    setText(value);

    // 실시간 유효성 검사
    if (validateOnChange && value.length > 0) {
      validateText(value);
    } else if (validateOnChange && value.length === 0) {
      setError(null);
    }
  };

  const handleSave = async () => {
    const trimmedText = text.trim();

    // 필수 입력 체크
    if (required && !trimmedText) {
      setError('필수 입력 항목입니다.');
      return;
    }

    // 유효성 검사
    if (validate && !validateText(trimmedText)) {
      return;
    }

    // 변경 사항이 없는 경우 체크 (옵션)
    if (trimmedText === initialValue?.trim()) {
      Alert.alert('알림', '변경사항이 없습니다.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedText);
      handleClose();
    } catch {
      // 에러는 상위에서 처리
    } finally {
      setIsSaving(false);
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

  const isDisabled = () => {
    if (required && !text.trim()) return true;
    if (error) return true;
    if (isSaving) return true;
    return false;
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
          <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
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
                paddingBottom: insets.bottom,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* 헤더 */}
            <View style={styles.header}>
              <Typography variant="h3">{title}</Typography>
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
                    height: multiline ? 100 : 50,
                    textAlignVertical: multiline ? 'top' : 'center',
                    borderColor: error ? colors.error : colors.border,
                    borderWidth: error ? 1 : 0,
                  },
                ]}
                value={text}
                onChangeText={handleChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                maxLength={maxLength}
                multiline={multiline}
                autoFocus={false}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                keyboardType={keyboardType}
                returnKeyType={multiline ? 'default' : 'done'}
                onSubmitEditing={multiline ? undefined : handleSave}
              />

              {/* 에러 메시지 */}
              {error && (
                <Typography
                  variant="caption"
                  color="error"
                  style={styles.errorText}
                >
                  {error}
                </Typography>
              )}

              {/* 도움말 텍스트 */}
              {helperText && !error && (
                <Typography
                  variant="caption"
                  color="secondary"
                  style={styles.helperText}
                >
                  {helperText}
                </Typography>
              )}

              {/* 글자 수 표시 */}
              {shouldShowCharCount && maxLength && (
                <Typography
                  variant="caption"
                  color="secondary"
                  style={styles.charCount}
                >
                  {text.length}/{maxLength}
                </Typography>
              )}
            </View>

            {/* 저장 버튼 */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.tint,
                  opacity: isDisabled() ? 0.5 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={isDisabled()}
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
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  errorText: {
    marginTop: 8,
    marginLeft: 4,
  },
  helperText: {
    marginTop: 8,
    marginLeft: 4,
  },
  charCount: {
    marginTop: 8,
    textAlign: 'right',
  },
  saveButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
});
