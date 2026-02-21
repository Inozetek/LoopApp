import React, { createContext, useContext, useState, useEffect } from 'react';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      // Dynamic require so the app doesn't crash if native module isn't linked yet
      // (requires a dev build rebuild after installing @react-native-community/netinfo)
      const NetInfo = require('@react-native-community/netinfo').default;
      unsubscribe = NetInfo.addEventListener((state: any) => {
        setIsConnected(state.isConnected ?? true);
        setIsInternetReachable(state.isInternetReachable);
      });
    } catch {
      // Native module not available (needs dev build rebuild) — assume connected
      console.warn('[NetworkProvider] NetInfo native module not available. Rebuild your dev client to enable offline detection.');
    }

    return () => unsubscribe?.();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, isInternetReachable }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
