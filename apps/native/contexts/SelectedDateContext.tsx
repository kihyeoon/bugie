import React, { createContext, useContext, useMemo, useState } from 'react';

interface SelectedDateContextValue {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

const SelectedDateContext = createContext<SelectedDateContextValue | undefined>(
  undefined
);

export function SelectedDateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const value = useMemo(
    () => ({ selectedDate, setSelectedDate }),
    [selectedDate]
  );

  return (
    <SelectedDateContext.Provider value={value}>
      {children}
    </SelectedDateContext.Provider>
  );
}

export function useSelectedDate() {
  const context = useContext(SelectedDateContext);
  if (!context) {
    throw new Error(
      'useSelectedDate must be used within a SelectedDateProvider'
    );
  }
  return context;
}
