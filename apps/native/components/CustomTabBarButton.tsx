import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from './ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function CustomTabBarButton(props: BottomTabBarButtonProps) {
  const colorScheme = useColorScheme();
  const { children, onPress, accessibilityState } = props;
  const isSelected = accessibilityState?.selected;

  return (
    <TouchableOpacity
      {...props}
      style={styles.container}
      onPress={(e) => {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress?.(e);
      }}
    >
      <View 
        style={[
          styles.button,
          { backgroundColor: Colors[colorScheme ?? 'light'].tint }
        ]}
      >
        <IconSymbol
          name="plus"
          size={28}
          color="white"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});