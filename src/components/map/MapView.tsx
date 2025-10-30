import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { MapView as MappedInMapView, useMap, Marker } from '@mappedin/react-native-sdk';
import { supabase } from '../../services/supabase';

interface MapViewComponentProps {
  onLocationSelect?: (locationId: string, locationName: string, locationData?: any) => void;
  selectedCategory?: string;
  onStallClick?: (stallNumber: string) => void;
}

interface StallLabel {
  id: string;
  name: string;
  poi_id: string;
  prefix?: string;
}

// Inner component that uses map hooks and renders stall labels
const MapContent: React.FC<{ selectedCategory?: string; onStallClick?: (stallNumber: string) => void }> = ({ selectedCategory, onStallClick }) => {
  const { mapData, mapView } = useMap();
  const [stallLabels, setStallLabels] = useState<StallLabel[]>([]);

  // Handle space clicks
  React.useEffect(() => {
    if (!mapView) return;

    const handleClick = (event: any) => {
      console.log('=== MAP CLICK EVENT ===');
      console.log('Event spaces:', event.spaces);
      console.log('Total stall labels:', stallLabels.length);
      
      if (event.spaces && event.spaces.length > 0) {
        const clickedSpace = event.spaces[0];
        console.log('Clicked space ID:', clickedSpace.id);
        console.log('Clicked space name:', clickedSpace.name);
        
        // Try to find stall by space ID first
        let clickedStall = stallLabels.find(label => label.poi_id === clickedSpace.id);
        
        // If not found by ID, try matching by name (space.name should match stall.name)
        if (!clickedStall) {
          clickedStall = stallLabels.find(label => label.name === clickedSpace.name);
          console.log('Searching by name instead. Found:', clickedStall);
        }
        
        console.log('Found stall:', clickedStall);
        console.log('onStallClick available:', !!onStallClick);
        
        if (clickedStall && onStallClick) {
          console.log('Calling onStallClick with:', clickedStall.name);
          onStallClick(clickedStall.name);
        } else if (!clickedStall) {
          console.log('No stall found for this space');
          console.log('Space name:', clickedSpace.name);
          console.log('First 5 stall labels:', stallLabels.slice(0, 5).map(l => ({ name: l.name, poi_id: l.poi_id })));
        } else {
          console.log('onStallClick not available');
        }
      } else {
        console.log('No spaces in click event - you might be clicking on the map background');
      }
    };

    mapView.on('click', handleClick);

    return () => {
      mapView.off('click', handleClick);
    };
  }, [mapView, stallLabels, onStallClick]);

  // Log when category changes
  React.useEffect(() => {
    console.log('Selected category changed:', selectedCategory);
  }, [selectedCategory]);

  // Zoom to highlighted stalls when category changes
  React.useEffect(() => {
    if (!mapData || !mapView || !selectedCategory || stallLabels.length === 0) return;

    console.log('Attempting to zoom to category:', selectedCategory);
    
    // Map category names to prefixes
    const categoryPrefixMap: { [key: string]: string } = {
      'fish': 'F-',
      'fruits & vegetables': 'FV-',
      'dried fish': 'DF-',
      'grocery': 'G-',
      'rice & grain': 'RG-',
      'variety': 'V-',
      'meat': 'M-',
    };

    const prefix = categoryPrefixMap[selectedCategory.toLowerCase()];
    console.log('Looking for stalls with prefix:', prefix);

    // Find all stalls matching the prefix
    const matchingStalls = stallLabels.filter(label => 
      prefix && label.name.startsWith(prefix)
    );

    console.log('Found', matchingStalls.length, 'stalls matching category:', selectedCategory);

    if (matchingStalls.length === 0) return;

    // Get the spaces for these stalls
    const matchingSpaces = matchingStalls
      .map(label => mapData.getByType('space').find((s: any) => s.id === label.poi_id))
      .filter((s): s is any => s !== undefined);

    if (matchingSpaces.length > 0) {
      console.log('Focusing on', matchingSpaces.length, 'spaces');
      // Focus the camera on these spaces
      mapView.Camera.focusOn(matchingSpaces);
    }
  }, [mapData, mapView, selectedCategory, stallLabels]);

  React.useEffect(() => {
    if (!mapData) return;

    const fetchAndPositionStalls = async () => {
      try {
        // Fetch stalls from database
        const { data: stalls, error } = await supabase
          .from('stalls_mapped_view')
          .select('stall_id, stall_number, poi_id, poi_name')
          .order('stall_number');
        
        if (error) throw error;
        if (!stalls) return;

        console.log('Loaded', stalls.length, 'stalls from database');
        const spaces = mapData.getByType('space');
        console.log('Map has', spaces.length, 'spaces');
        
        // Log first few spaces to understand their structure
        if (spaces.length > 0) {
          console.log('First space:', JSON.stringify({
            id: spaces[0].id,
            name: spaces[0].name,
            externalId: spaces[0].externalId,
          }));
          console.log('Second space:', JSON.stringify({
            id: spaces[1]?.id,
            name: spaces[1]?.name,
            externalId: spaces[1]?.externalId,
          }));
        }
        
        // Log first few stalls
        if (stalls.length > 0) {
          console.log('First stall:', JSON.stringify({
            stall_number: stalls[0].stall_number,
            poi_id: stalls[0].poi_id,
            poi_name: stalls[0].poi_name,
          }));
        }

        // Match stalls to map spaces and create labels
        const labels: StallLabel[] = [];
        
        for (const stall of stalls) {
          // Match by space name = stall number (e.g., "M-40" === "M-40")
          let space = mapData.getByType('space').find((s: any) => 
            s.name === stall.stall_number
          );
          
          // Fallback: try matching by poi_name
          if (!space) {
            space = mapData.getByType('space').find((s: any) => 
              s.name === stall.poi_name
            );
          }

          if (space) {
            // Extract prefix from stall number (e.g., "F-1" -> "F-", "DF-1" -> "DF-")
            const prefix = stall.stall_number.match(/^[A-Z]+-/)?.[0] || '';
            
            labels.push({
              id: stall.stall_id,
              name: stall.stall_number,
              poi_id: space.id, // Use the space ID instead of poi_id
              prefix: prefix,
            });
          }
        }

        console.log('Sample stall prefixes:');
        labels.slice(0, 10).forEach(l => console.log(`  ${l.name} -> prefix: "${l.prefix}"`));

        console.log('Created', labels.length, 'labels for stalls that match spaces');
        console.log('First label object:', JSON.stringify(labels[0]));
        
        setStallLabels(labels);
      } catch (error) {
        console.error('Error loading stalls:', error);
      }
    };

    fetchAndPositionStalls();
  }, [mapData]);

  if (!mapData) return null;

  // Render labels using Mappedin Marker component
  return (
    <>
      {stallLabels.map((label, index) => {
        const space = mapData.getByType('space').find((s: any) => 
          s.externalId === label.poi_id || s.id === label.poi_id
        );
        
        if (!space) return null;

        // Map category names to prefixes
        const categoryPrefixMap: { [key: string]: string } = {
          'fish': 'F-',
          'fruits & vegetables': 'FV-',
          'dried fish': 'DF-',
          'grocery': 'G-',
          'rice & grain': 'RG-',
          'variety': 'V-',
          'meat': 'M-',
        };

        const expectedPrefix = selectedCategory ? categoryPrefixMap[selectedCategory.toLowerCase()] : null;
        
        // Extract prefix directly from the name since label.prefix might not be set yet
        const actualPrefix = label.name.match(/^[A-Z]+-/)?.[0] || '';
        const isHighlighted = expectedPrefix && actualPrefix === expectedPrefix;

        // Debug logging for first few labels when category is selected
        if (index < 3 && selectedCategory) {
          console.log(`Label: ${label.name}, actualPrefix: "${actualPrefix}", expectedPrefix: "${expectedPrefix}", highlighted: ${isHighlighted}`);
        }

        // Only show highlighted color for matching stalls, normal for everything else
        let backgroundColor = 'rgba(255,255,255,0.85)';
        let textColor = '#222';
        let borderColor = '#999';
        
        if (isHighlighted) {
          // Highlighted stalls - bright green
          backgroundColor = '#10B981';
          textColor = '#ffffff';
          borderColor = '#059669';
        }

        return (
          <Marker
            key={`${label.id}-${selectedCategory || 'none'}`}
            target={space}
            html={`<div style="background: ${backgroundColor}; color: ${textColor}; padding: 1px 3px; border-radius: 2px; font-size: 6px; font-weight: 500; border: 0.5px solid ${borderColor}; white-space: nowrap; line-height: 1;">${label.name}</div>`}
            options={{
              rank: 'always-visible',
            }}
          />
        );
      })}
    </>
  );
};

const MapViewComponent: React.FC<MapViewComponentProps> = ({ onLocationSelect: _onLocationSelect, selectedCategory: _selectedCategory, onStallClick }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize credentials to prevent re-creation on every render
  const credentials = useMemo(() => ({
    key: 'mik_M8uMQcxJZDWRbwmrR542e07af',
    secret: 'mis_4sDELo8xqkrXxLMPEUXzDQsf71J3bvI1UhbUVcWm3WW8dfa102e',
    mapId: '68ee9141b47af0000bc138c1',
  }), []);

  // Map options
  const mapOptions = useMemo(() => ({
    backgroundColor: '#f5f5f5',
    outdoorView: {
      enabled: false
    },
    shadowColor: '#000000',
    multiBufferRendering: false,
  }), []);

  const handleMapReady = useCallback(() => {
    console.log('Map view ready');
    setLoading(false);
  }, []);

  const handleError = useCallback((err: Error) => {
    console.error('Map view error:', err);
    setError(err.message);
    setLoading(false);
  }, []);

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
      
      <MappedInMapView
        key="mappedin-map-view"
        mapData={credentials}
        options={mapOptions}
        onMapReady={handleMapReady}
        onError={handleError}
        style={styles.map}
      >
        <MapContent selectedCategory={_selectedCategory} onStallClick={onStallClick} />
      </MappedInMapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#ff0000',
    textAlign: 'center',
  },
  stallListButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  stallListButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    padding: 5,
  },
  stallItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stallNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  stallName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
});

export default React.memo(MapViewComponent);