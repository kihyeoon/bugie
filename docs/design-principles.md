# Bugie 디자인 원칙

## 📋 개요

Bugie는 깔끔하고 직관적인 금융 서비스 경험을 제공하기 위해 미니멀하고 모던한 디자인 시스템을 채택했습니다. 이 문서는 일관된 사용자 경험을 구현하기 위한 디자인 가이드라인을 제공합니다.

### 디자인 철학

- **명확성**: 정보의 계층 구조가 뚜렷하고 이해하기 쉬워야 함
- **간결성**: 불필요한 장식을 배제하고 핵심 기능에 집중
- **일관성**: 모든 화면과 컴포넌트에서 통일된 디자인 언어 사용
- **접근성**: 모든 사용자가 편하게 사용할 수 있는 인터페이스

### 핵심 가치

1. **신뢰성**: 금융 앱으로서 안정적이고 믿을 수 있는 느낌 전달
2. **효율성**: 빠르고 직관적인 사용자 플로우
3. **현대성**: 최신 디자인 트렌드를 반영한 세련된 인터페이스

---

## 🎨 색상 시스템

### 브랜드 컬러

```typescript
// 메인 브랜드 색상
const brandColors = {
  primary: '#3182F6', // 메인 파란색
  primaryDark: '#4E7EFF', // 다크모드용 밝은 파란색
  primaryLight: '#E8F3FF', // 연한 파란색 배경
};
```

### 텍스트 색상 계층

라이트 모드:

- **Primary Text**: `#191F28` - 제목, 중요 정보
- **Secondary Text**: `#8B95A1` - 부가 정보, 설명
- **Disabled Text**: `#B0B8C1` - 비활성 상태

다크 모드:

- **Primary Text**: `#FFFFFF`
- **Secondary Text**: `#B0B8C1`
- **Disabled Text**: `#8B95A1`

### 배경 색상

라이트 모드:

- **Primary Background**: `#FFFFFF` - 메인 배경
- **Secondary Background**: `#F2F4F6` - 카드, 섹션 구분

다크 모드:

- **Primary Background**: `#191F28`
- **Secondary Background**: `#242D3C`

### 시맨틱 색상

```typescript
const semanticColors = {
  income: '#4E7EFF', // 수입 (파란색)
  expense: '#FF5A5F', // 지출 (빨간색)
  success: '#10B981', // 성공
  warning: '#F59E0B', // 경고
  error: '#EF4444', // 오류
};
```

### 기타 UI 색상

- **Border**: `#E5E8EB` (Light) / `#2A3F5F` (Dark)
- **Icon Default**: `#8B95A1`
- **Shadow**: `#000000` (opacity 조절)

---

## 📝 타이포그래피

### 폰트 크기 체계

```typescript
const fontSize = {
  // 제목
  h1: 28, // 페이지 제목
  h2: 24, // 섹션 제목
  h3: 18, // 서브 제목

  // 본문
  large: 17, // 강조 텍스트
  regular: 16, // 기본 텍스트
  small: 15, // 보조 텍스트
  tiny: 13, // 캡션, 라벨

  // 특수
  amount: 48, // 금액 표시
  button: 17, // 버튼 텍스트
  tab: 11, // 탭 라벨
};
```

### 폰트 굵기

```typescript
const fontWeight = {
  bold: '700', // 제목, 강조
  semiBold: '600', // 부제목, 버튼
  medium: '500', // 기본 텍스트
  regular: '400', // 보조 텍스트
};
```

### 자간 (Letter Spacing)

```typescript
const letterSpacing = {
  tight: -1, // 큰 금액 표시
  medium: -0.5, // 제목
  regular: -0.3, // 일반 텍스트
  small: -0.2, // 작은 텍스트
};
```

### 텍스트 스타일 예시

```typescript
// 페이지 제목
{
  fontSize: 28,
  fontWeight: '700',
  letterSpacing: -0.5,
  color: colors.text
}

// 금액 표시
{
  fontSize: 48,
  fontWeight: '700',
  letterSpacing: -1,
  color: colors.income // or colors.expense
}

// 버튼 텍스트
{
  fontSize: 17,
  fontWeight: '600',
  letterSpacing: -0.3,
  color: 'white'
}
```

---

## 📐 레이아웃 & 간격

### 기본 여백 시스템

```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
```

### 컨테이너 패딩

- **화면 좌우 패딩**: 24px
- **섹션 상하 간격**: 20-24px
- **카드 내부 패딩**: 20-24px

### 컴포넌트 간격

- **버튼 간 간격**: 8-12px
- **리스트 아이템 간격**: 0px (구분선 사용)
- **폼 필드 간격**: 20px
- **카테고리 칩 간격**: 8px

### Safe Area 처리

```typescript
// iOS Safe Area
header: {
  paddingTop: 60,  // Status bar + 여유 공간
}

// 하단 탭바
tabBar: {
  height: Platform.select({
    ios: 85,     // Safe area 포함
    default: 60
  })
}
```

---

## 🧩 컴포넌트 디자인

### 버튼

**Primary Button (CTA)**

```typescript
{
  backgroundColor: colors.tint,
  paddingVertical: 16-18,
  paddingHorizontal: 24,
  borderRadius: 12,
  // 텍스트
  color: 'white',
  fontSize: 17,
  fontWeight: '600'
}
```

**Secondary Button**

```typescript
{
  backgroundColor: colors.backgroundSecondary,
  // 동일한 패딩과 border radius
}
```

**Disabled State**

```typescript
{
  backgroundColor: colors.textDisabled,
  opacity: 1 // opacity 대신 색상으로 표현
}
```

### 카드

```typescript
{
  backgroundColor: colors.background,
  borderRadius: 16,
  padding: 24,
  // 그림자 (subtle)
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2
}
```

### 입력 필드

```typescript
{
  backgroundColor: colors.backgroundSecondary,
  borderRadius: 12,
  padding: 16,
  fontSize: 15,
  letterSpacing: -0.3,
  // 포커스 상태
  borderWidth: 1,
  borderColor: colors.tint
}
```

### 토글/스위치

```typescript
// 컨테이너
{
  backgroundColor: colors.backgroundSecondary,
  borderRadius: 12,
  padding: 4
}

// 활성 버튼
{
  backgroundColor: colors.background,
  borderRadius: 8,
  // 부드러운 전환
  transition: 'all 0.2s ease'
}
```

### 플로팅 액션 버튼

```typescript
{
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: colors.tint,
  // 은은한 그림자
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3
}
```

---

## ✨ 인터랙션 & 애니메이션

### 터치 피드백

- **TouchableOpacity**: `activeOpacity={0.7}` 또는 `0.8`
- **Ripple Effect**: Android에서 Material Design ripple 사용
- **Haptic Feedback**: iOS에서 중요한 액션에 햅틱 피드백 추가

### 전환 효과

- **기본 duration**: 200-300ms
- **Easing**: `ease-out` 또는 `ease-in-out`
- **스크롤 애니메이션**: 네이티브 드라이버 사용 권장

```typescript
// 예시: 캘린더 확장/축소
Animated.timing(animatedValue, {
  toValue: expanded ? 1 : 0,
  duration: 300,
  easing: Easing.out(Easing.ease),
  useNativeDriver: true,
}).start();
```

### 로딩 상태

- **스켈레톤 스크린**: 콘텐츠 로딩 시
- **스피너**: 액션 진행 중
- **프로그레스 바**: 긴 작업 진행 시

---

## ♿ 접근성

### 색상 대비

- 텍스트와 배경 간 최소 4.5:1 대비율 유지
- 중요 정보는 색상만으로 구분하지 않음
- 수입(파란색)과 지출(빨간색) 외에 +/- 기호 함께 사용

### 터치 영역

- 최소 터치 영역: 44x44pt (iOS) / 48x48dp (Android)
- 버튼 간 충분한 간격 유지 (최소 8px)

### 텍스트 가독성

- 본문 최소 크기: 15px
- 충분한 line height (1.4-1.6배)
- 긴 텍스트는 적절히 줄바꿈

### 스크린 리더

- 모든 인터랙티브 요소에 적절한 라벨 제공
- 아이콘 버튼에 accessibilityLabel 추가
- 장식적 요소는 accessibilityElementsHidden 처리

---

## 💻 구현 가이드

### 색상 사용

```typescript
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// 컴포넌트 내부
const colorScheme = useColorScheme();
const colors = Colors[colorScheme ?? 'light'];

// 스타일 적용
<Text style={{ color: colors.text }}>메인 텍스트</Text>
<Text style={{ color: colors.textSecondary }}>보조 텍스트</Text>
```

### 반응형 스타일

```typescript
// 플랫폼별 스타일
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
```

### 일관성 체크리스트

- [ ] 색상은 Colors.ts에서만 가져와 사용
- [ ] 폰트 크기와 굵기는 정의된 체계 따르기
- [ ] 패딩과 마진은 spacing 시스템 활용
- [ ] 모든 텍스트에 적절한 색상 계층 적용
- [ ] 버튼과 터치 영역은 최소 크기 준수
- [ ] 다크모드에서도 정상 동작 확인

### 컴포넌트 재사용

```typescript
// 공통 버튼 컴포넌트 예시
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled }: ButtonProps) {
  const colors = Colors[useColorScheme() ?? 'light'];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' && { backgroundColor: colors.tint },
        variant === 'secondary' && { backgroundColor: colors.backgroundSecondary },
        disabled && { backgroundColor: colors.textDisabled }
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}
```

---

## 📋 체크리스트

새로운 화면이나 컴포넌트를 개발할 때 확인사항:

### 디자인

- [ ] 정의된 색상 팔레트만 사용
- [ ] 타이포그래피 체계 준수
- [ ] 일관된 spacing 시스템 적용
- [ ] 적절한 터치 피드백 구현

### 기능

- [ ] 라이트/다크 모드 모두 지원
- [ ] iOS/Android 플랫폼별 최적화
- [ ] 로딩/에러 상태 처리
- [ ] 접근성 기준 충족

### 성능

- [ ] 불필요한 리렌더링 방지
- [ ] 이미지 최적화
- [ ] 애니메이션 성능 (60fps)
- [ ] 메모리 사용량 체크

---

이 문서는 Bugie의 디자인 시스템 진화에 따라 지속적으로 업데이트됩니다.

마지막 업데이트: 2025-08-02
