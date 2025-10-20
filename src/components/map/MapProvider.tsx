import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { MapView, useMap } from '@mappedin/react-native-sdk';
import { MAPPEDIN_CONFIG } from '../../config/mappedin';

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

// Frozen, stable config objects - never recreated
const MAPDATA_OPTIONS = Object.freeze({
  key: MAPPEDIN_CONFIG.key,
  secret: MAPPEDIN_CONFIG.secret,
  mapId: MAPPEDIN_CONFIG.mapId,
});

const MAP_OPTIONS = Object.freeze({});

// Global flags to survive hot reloads and prevent duplicate SDK init
// @ts-ignore
if (typeof global.__mappedinInitialized === 'undefined') {
  // @ts-ignore
  global.__mappedinInitialized = false;
}
// @ts-ignore
if (typeof global.__mapViewMounted === 'undefined') {
  // @ts-ignore
  global.__mapViewMounted = false;
}
// @ts-ignore
if (typeof global.__mappedinFatal === 'undefined') {
  // @ts-ignore
  global.__mappedinFatal = false;
}

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  // @ts-ignore - Initialize from global state
  const [ready, setReady] = useState(global.__mappedinInitialized || false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<MapOverlayContextType['params']>(null);
  const [startTs, setStartTs] = useState<number | null>(null);
  const [mapKey, setMapKey] = useState(0); // Key to force remount on critical errors
  // @ts-ignore - Initialize from global state
  const [hasEverShown, setHasEverShown] = useState(global.__mappedinInitialized || false);
  // @ts-ignore - Initialize from global state
  const [canMount, setCanMount] = useState(global.__mappedinInitialized || false);
  // @ts-ignore - Initialize from global state
  const [permanentFailure, setPermanentFailure] = useState<boolean>(global.__mappedinFatal || false);

  // Prevent mounting if already mounted globally
  React.useEffect(() => {
    return () => {
      // @ts-ignore
      global.__mapViewMounted = false;
      // @ts-ignore
      if (!global.__mappedinFatal) {
        global.__mappedinInitialized = false;
      }
      console.log('[MapProvider] Component unmounting - releasing global lock');
    };
  }, []);

  const showMap = useCallback((p?: { stallNumber?: string; vendorName?: string }) => {
    console.log('[MapProvider] showMap called');
    
    setParams(p || null);
    setVisible(true);
    if (permanentFailure) {
      console.warn('[MapProvider] Map disabled due to previous fatal error');
      setError('Map is currently unavailable. Please restart the app later.');
      return;
    }

    // @ts-ignore - Check global state
    if (!global.__mappedinInitialized && !global.__mapViewMounted) {
      console.log('[MapProvider] First showMap call - will mount MapView');
      // @ts-ignore - Set global lock IMMEDIATELY
      global.__mapViewMounted = true;
      // @ts-ignore
      global.__mappedinInitialized = true;
      setHasEverShown(true);
      setError(null);
      setStartTs(Date.now());
      // Delay mount slightly to ensure only one instance
      setTimeout(() => setCanMount(true), 100);
    } else {
      console.log('[MapProvider] Map already initialized globally - just showing overlay');
    }
  }, [permanentFailure]);

  const hideMap = useCallback(() => {
    setVisible(false);
    setParams(null);
  }, []);

  const value = useMemo(() => ({ showMap, hideMap, isVisible: visible, params }), [showMap, hideMap, visible, params]);

  // Failsafe: if map isn't ready within 25s of showing, surface a timeout error
  React.useEffect(() => {
    if (!visible || ready) return;
    const t = setTimeout(() => {
      if (!ready) setError('Timed out loading the map. Please check your internet and credentials.');
    }, 25000);
    return () => clearTimeout(t);
  }, [visible, ready]);

  // Child component that flips ready true once mapData+mapView are available via useMap
  const MapReadyWatcher: React.FC = () => {
    const { mapData, mapView } = useMap();
    React.useEffect(() => {
      if (mapData && mapView && !ready) {
        // @ts-ignore
        global.__mappedinInitialized = true;
        setReady(true);
        setError(null);
        if (startTs) console.log(`[MapProvider] Ready in ${(Date.now() - startTs) / 1000}s`);
      }
    }, [mapData, mapView]);
    return null;
  };

  return (
    <MapOverlayContext.Provider value={value}>
      <View style={styles.container}>{children}</View>
      {/* Only mount MapView when explicitly requested and after delay - keep mounted once initialized */}
      {hasEverShown && canMount && !permanentFailure && (
        <View pointerEvents={visible ? 'auto' : 'none'} style={[styles.overlay, !visible && styles.invisible]}> 
          <MapView
            key={`map-${mapKey}`}
            style={styles.map}
            options={MAP_OPTIONS}
            mapData={MAPDATA_OPTIONS}
            onMapReady={() => {
              // @ts-ignore
              global.__mappedinInitialized = true;
              setReady(true);
              setError(null);
              console.log('[MapProvider] Map ready - SDK initialized');
            }}
            onError={(e) => {
              try {
                console.error('[MapProvider] Map error:', e);
                const detail = typeof e === 'string' ? e : (e?.message || JSON.stringify(e));
                
                // If map is already ready, ignore the "getMapData can only be called once" error
                // This is a bug in the Mappedin SDK where it calls getMapData multiple times internally
                if (ready && detail && detail.includes('getMapData can only be called once')) {
                  console.log('[MapProvider] Ignoring duplicate getMapData error - map already initialized');
                  return;
                }

                if (detail && detail.includes('getMapData can only be called once')) {
                  console.log('[MapProvider] Fatal map error encountered, disabling map');
                  // @ts-ignore
                  global.__mappedinFatal = true;
                  setPermanentFailure(true);
                  setCanMount(false);
                  setReady(false);
                  // @ts-ignore
                  global.__mapViewMounted = false;
                  setError('Map is temporarily unavailable. Please restart the app later.');
                  return;
                }
                
                setError(detail || 'Failed to load map');
              } catch {
                setError('Failed to load map');
              }
            }}
          >
            {/* watcher marks ready when map context becomes available */}
            <MapReadyWatcher />
          </MapView>
          {!ready && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading map…</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorTitle}>Map Error</Text>
              <Text style={styles.errorText}>{error}</Text>
              {error.includes('getMapData can only be called once') && (
                <Text style={styles.errorHint}>
                  This happens with hot reload.{'\n'}
                  Close and restart the app to fix.
                </Text>
              )}
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  console.log('[MapProvider] Closing error overlay');
                  setError(null);
                }}
              >
                <Text style={styles.retryText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      {permanentFailure && visible && (
        <View style={styles.permanentOverlay} pointerEvents="auto">
          <Text style={styles.permanentTitle}>Map Unavailable</Text>
          <Text style={styles.permanentText}>
            We could not initialize the indoor map in this session. Please close the app fully and re-open it later.
          </Text>
        </View>
      )}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 12,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 14,
  },
  errorHint: {
    color: '#FFD93D',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
    fontSize: 13,
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  permanentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permanentTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  permanentText: {
    fontSize: 15,
    color: '#DDDDDD',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default MapProvider;
