import { ViewStyle } from 'react-native';
import { SharedValue } from 'react-native-reanimated';

export type CalendarMode = 'static' | 'scrollable';
export type ViewType = 'month' | 'week';

export interface DailyTransaction {
  income: number;
  expense: number;
}

export interface CalendarTransaction {
  [date: string]: DailyTransaction; // "2025-01-01" format
}

export interface CalendarAnimationConfig {
  threshold?: number; // Default: 50px
  duration?: number; // Default: 300ms
  enableSnap?: boolean; // Default: true
}

export interface CalendarProps {
  // Mode configuration
  mode?: CalendarMode;
  viewType?: ViewType;
  
  // Data
  selectedDate?: Date;
  transactions?: CalendarTransaction;
  
  // Events
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (year: number, month: number) => void;
  
  // Animation (for scrollable mode)
  scrollY?: SharedValue<number>;
  animationConfig?: CalendarAnimationConfig;
  
  // Styling
  containerStyle?: ViewStyle;
  headerStyle?: ViewStyle;
  dayStyle?: ViewStyle;
  
  // Customization
  renderDay?: (date: Date, transaction?: DailyTransaction) => React.ReactNode;
  locale?: string;
  showHeader?: boolean;
}

export interface CalendarContextValue {
  mode: CalendarMode;
  viewType: ViewType;
  selectedDate?: Date;
  currentMonth: Date;
  transactions?: CalendarTransaction;
  
  // Animation values
  animatedHeight?: SharedValue<number>;
  animatedOpacity?: SharedValue<number>;
  
  // Actions
  selectDate: (date: Date) => void;
  changeMonth: (year: number, month: number) => void;
  setViewType: (type: ViewType) => void;
}

export interface CalendarDayProps {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
  transaction?: DailyTransaction;
  onPress: () => void;
}

export interface CalendarHeaderProps {
  currentMonth: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

export interface CalendarDate {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  weekIndex: number;
  dayIndex: number;
}