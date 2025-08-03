import React, { createContext, useContext, useMemo } from 'react';
import { createCoreServices } from '../services/core/createServices';
import type { CoreServices } from '../services/core/types';

const ServiceContext = createContext<CoreServices | undefined>(undefined);

export function ServiceProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => createCoreServices(), []);

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices(): CoreServices {
  const context = useContext(ServiceContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}