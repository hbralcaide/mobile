import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';

type MapOverlayContextType = {
  showMap: (params?: { stallNumber?: string; vendorName?: string }) => void;
  hideMap: () => void;
  isVisible: boolean;
  params?: { stallNumber?: string; vendorName?: string } | null;
};

const MapOverlayContext = createContext<MapOverlayContextType | undefined>(undefined);

export const useMapOverlay = () => {
  const ctx = useContext(MapOverlayContext);
  if (!ctx) throw new Error('useMapOverlay must be used within MapProvider');
  return ctx;
};

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible] = useState(false);
  const [params] = useState<MapOverlayContextType['params']>(null);
  const showMap = useCallback((_p?: { stallNumber?: string; vendorName?: string }) => {
    // No-op stub: WebView-based map is used elsewhere.
    console.log('[MapProvider] showMap called (stub)');
  }, []);
  const hideMap = useCallback(() => {
    // No-op stub
    console.log('[MapProvider] hideMap called (stub)');
  }, []);
  const value = useMemo(() => ({ showMap, hideMap, isVisible: visible, params }), [showMap, hideMap, visible, params]);

  return (
    <MapOverlayContext.Provider value={value}>
      <View style={styles.container}>{children}</View>
      {/* Map overlay is disabled in this build; WebView-based Mappedin is used instead. */}
    </MapOverlayContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
  },
  invisible: { opacity: 0 },
  map: { flex: 1 },
});

export default MapProvider;
