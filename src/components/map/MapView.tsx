import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapView as MappedInMapView, useMap, Marker, Path } from '@mappedin/react-native-sdk';
import Geolocation from '@react-native-community/geolocation';
import { supabase } from '../../services/supabase';
import LocationPermissionModal from '../modals/LocationPermissionModal';

interface MapViewComponentProps {
  onLocationSelect?: (locationId: string, locationName: string, locationData?: any) => void;
  selectedCategory?: string;
  onStallClick?: (stallNumber: string) => void;
  onVendorClick?: (vendorId: string) => void;
  focusStall?: string;
}

interface StallLabel {
  id: string;
  name: string;
  poi_id: string;
  prefix?: string;
}

// Inner component that uses map hooks and renders stall labels
const MapContent: React.FC<{ selectedCategory?: string; onVendorClick?: (vendorId: string) => void; focusStall?: string }> = ({ selectedCategory, onVendorClick, focusStall }) => {
  const { mapData, mapView } = useMap();
  const [stallLabels, setStallLabels] = useState<StallLabel[]>([]);
  const [highlightedStall, setHighlightedStall] = useState<string | null>(null);
  const [highlightedVendorName, setHighlightedVendorName] = useState<string | null>(null);
  const [previousHighlightedSpace, setPreviousHighlightedSpace] = useState<any>(null);
  const [pathCoordinates, setPathCoordinates] = useState<any[] | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [_locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'found' | 'timeout' | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const [categoryVendors, setCategoryVendors] = useState<Array<{ stallNumber: string; vendorName: string; poi_id: string }>>([]);

  // Debug modal state removed - now using navigation instead

  const startLocationTracking = React.useCallback(() => {
    // Butuan Mega Market center coordinates
    const MARKET_CENTER = {
      lat: 8.9474,
      lng: 125.5406,
    };
    
    const validateLocation = (latitude: number, longitude: number): boolean => {
      // Calculate distance from market center
      const latDiff = latitude - MARKET_CENTER.lat;
      const lngDiff = longitude - MARKET_CENTER.lng;
      const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
      const distanceMeters = distanceKm * 1000;
      
      // Only accept GPS if within 100 meters of market
      return distanceMeters < 100;
    };
    
    // Get current position with timeout
    Geolocation.getCurrentPosition(
      (position) => {
        // Validate location before setting it
        if (validateLocation(position.coords.latitude, position.coords.longitude)) {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          // Auto-hide GPS status after 5 seconds
          setGpsStatus('found');
          setTimeout(() => {
            setGpsStatus(null);
          }, 5000);
        } else {
          setUserLocation(null);
          setGpsStatus(null);
        }
      },
      (error) => {
        // Silently handle errors - don't show to user
        setUserLocation(null);
        setGpsStatus(null);
        
        // Try again with lower accuracy settings (silent retry)
        if (error.code === 3) { // TIMEOUT
          Geolocation.getCurrentPosition(
            (position) => {
              // Validate location before setting it
              if (validateLocation(position.coords.latitude, position.coords.longitude)) {
                setUserLocation({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                });
                setGpsStatus('found');
                setTimeout(() => {
                  setGpsStatus(null);
                }, 5000);
              } else {
                setUserLocation(null);
                setGpsStatus(null);
              }
            },
            (_err) => {
              // Silent error handling
              setUserLocation(null);
              setGpsStatus(null);
            },
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    // Watch position for continuous updates
    const watchId = Geolocation.watchPosition(
      (position) => {
        console.log('📍 Location updated:', position.coords.latitude, position.coords.longitude);
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (gpsStatus !== 'found') {
          setGpsStatus('found');
        }
      },
      (error) => {
        console.error('Error watching location:', error);
      },
      { enableHighAccuracy: true, distanceFilter: 5 }
    );

    return () => {
      Geolocation.clearWatch(watchId);
    };
  }, [gpsStatus]);

  // Request location permissions and get current location
  React.useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Check persistent flag first
        const stored = await AsyncStorage.getItem('locationPermissionAsked');

        // On Android, also check actual permission state to avoid asking again
        let hasPermission = false;
        if (Platform.OS === 'android') {
          try {
            hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
          } catch (e) {
            hasPermission = false;
          }
        }

        if (hasPermission) {
          // Permission already granted at OS level
          if (mounted) {
            setLocationPermissionAsked(true);
            setShowLocationModal(false);
            // Start tracking immediately
            startLocationTracking();
          }
          return;
        }

        if (stored === 'true') {
          // User was already asked previously (either granted or denied) - don't show modal again
          if (mounted) {
            setLocationPermissionAsked(true);
            setShowLocationModal(false);
          }
          return;
        }

        // Not asked yet and permission not granted -> show modal after short delay
        const timer = setTimeout(() => {
          if (mounted) setShowLocationModal(true);
        }, 1000);
        cleanupTimerRef.current = timer as unknown as number;
      } catch (e) {
        // On error, show modal after delay as a fallback
        const timer = setTimeout(() => {
          if (mounted) setShowLocationModal(true);
        }, 1000);
        cleanupTimerRef.current = timer as unknown as number;
      }
    };

    init();

    return () => {
      mounted = false;
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, [startLocationTracking]);

  const handleRequestPermission = async () => {
    setShowLocationModal(false);
    setLocationPermissionAsked(true);
    try { await AsyncStorage.setItem('locationPermissionAsked', 'true'); } catch {}

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Mapalengke needs access to your location for accurate navigation',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted');
          startLocationTracking();
        } else {
          console.log('Location permission denied by user');
          // User chose not to grant permission - that's okay, navigation will use door entrance
        }
      } catch (err) {
        console.warn('Location permission error:', err);
      }
    } else {
      // iOS permissions are handled via Info.plist
      try { await AsyncStorage.setItem('locationPermissionAsked', 'true'); } catch {}
      startLocationTracking();
    }
  };

  const handleDenyPermission = () => {
    setShowLocationModal(false);
    setLocationPermissionAsked(true);
    try { AsyncStorage.setItem('locationPermissionAsked', 'true'); } catch {}
    console.log('User denied location permission via modal');
  };

  // Handle space clicks - navigate to vendor details
  React.useEffect(() => {
    if (!mapView) return;

    const handleClick = async (event: any) => {
      console.log('🖱️ Map clicked!', event);
      
      if (event.spaces && event.spaces.length > 0) {
        const clickedSpace = event.spaces[0];
        console.log('📍 Clicked space:', clickedSpace.name, clickedSpace.id);
        
        // Try to find stall by space ID first
        let clickedStall = stallLabels.find(label => label.poi_id === clickedSpace.id);
        
        // If not found by ID, try matching by name
        if (!clickedStall) {
          clickedStall = stallLabels.find(label => label.name === clickedSpace.name);
        }
        
        console.log('🏪 Found stall:', clickedStall);
        
        if (clickedStall && onVendorClick) {
          console.log('🔍 Fetching vendor for stall:', clickedStall.name);
          
          // Fetch vendor ID for this stall
          try {
            const { data, error } = await supabase
              .from('vendor_profiles')
              .select('id')
              .eq('stall_number', clickedStall.name)
              .single();
            
            console.log('📦 Vendor data:', data);
            console.log('❌ Error:', error);
            
            if (data && !error) {
              console.log('✅ Navigating to vendor details:', data.id);
              onVendorClick(data.id);
            } else {
              // No vendor found for this stall
              console.log('⚠️ No vendor found for stall:', clickedStall.name);
              // Still navigate with stall number to show "no vendor" screen
              onVendorClick(clickedStall.name);
            }
          } catch (err) {
            console.error('💥 Error fetching vendor:', err);
          }
        } else {
          console.log('⚠️ Stall not found in stallLabels or no callback');
        }
      } else {
        console.log('⚠️ No spaces in click event');
      }
    };

    mapView.on('click', handleClick);

    return () => {
      mapView.off('click', handleClick);
    };
  }, [mapView, stallLabels, onVendorClick]);

  // Log when category changes
  React.useEffect(() => {
    console.log('Selected category changed:', selectedCategory);
  }, [selectedCategory]);

  // Zoom to highlighted stalls when category changes
  React.useEffect(() => {
    if (!mapData || !mapView || !selectedCategory || stallLabels.length === 0) {
      // Clear category vendors when no category selected
      setCategoryVendors([]);
      return;
    }

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
      'eatery': 'E-',
    };

    const prefix = categoryPrefixMap[selectedCategory.toLowerCase()];
    console.log('Looking for stalls with prefix:', prefix);

    // Find all stalls matching the prefix
    const matchingStalls = stallLabels.filter(label => 
      prefix && label.name.startsWith(prefix)
    );

    console.log('Found', matchingStalls.length, 'stalls matching category:', selectedCategory);

    if (matchingStalls.length === 0) return;

    // Fetch vendor names for all matching stalls
    const fetchVendorNames = async () => {
      try {
        const stallNumbers = matchingStalls.map(s => s.name);
        const { data, error } = await supabase
          .from('vendor_profiles')
          .select('stall_number, business_name, first_name, last_name')
          .in('stall_number', stallNumbers);

        if (data && !error) {
          const vendors = data.map(vendor => {
            const vendorName = vendor.business_name || `${vendor.first_name} ${vendor.last_name}`;
            const matchingStall = matchingStalls.find(s => s.name === vendor.stall_number);
            return {
              stallNumber: vendor.stall_number,
              vendorName: vendorName,
              poi_id: matchingStall?.poi_id || '',
            };
          });
          setCategoryVendors(vendors);
        }
      } catch (error) {
        console.error('Error fetching vendor names:', error);
      }
    };

    fetchVendorNames();

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
        // Fetch only stalls that have vendors with products
        const { data: stalls, error } = await supabase
          .from('stalls_mapped_view')
          .select(`
            stall_id, 
            stall_number, 
            poi_id, 
            poi_name,
            vendor_profiles!inner(
              id,
              vendor_products!inner(id)
            )
          `)
          .order('stall_number');
        
        if (error) throw error;
        if (!stalls) return;

        console.log('Loaded', stalls.length, 'stalls with vendors who have products');
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
        
        // Apply color coding to stalls based on their category
        if (mapView) {
          // Define color scheme for each section
          const sectionColors: { [key: string]: string } = {
            'E-': '#FF6B6B',      // Eatery - Red
            'FV-': '#4CAF50',     // Fruits & Vegetables - Green
            'DF-': '#FF9800',     // Dried Fish - Orange
            'G-': '#2196F3',      // Grocery - Blue
            'RG-': '#FFC107',     // Rice & Grains - Amber
            'V-': '#9C27B0',      // Variety - Purple
            'F-': '#00BCD4',      // Fish - Cyan
            'M-': '#F44336',      // Meat - Deep Red
          };
          
          console.log('🎨 Applying color coding to stalls...');
          
          // Apply colors to all stalls based on their prefix
          labels.forEach((label) => {
            const space = mapData.getByType('space').find((s: any) => s.id === label.poi_id);
            if (space && label.prefix) {
              const color = sectionColors[label.prefix];
              if (color) {
                try {
                  mapView.updateState(space, {
                    color: color,
                    hoverColor: color, // Keep same color on hover
                    interactive: true, // Make space clickable
                  });
                } catch (err) {
                  // Ignore individual errors
                }
              }
            }
          });
          
          console.log('✅ Color coding applied to', labels.length, 'stalls');
        }
        
        // Set initial camera position to show the market with better zoom and angle
        if (mapView && !focusStall) {
          try {
            const floors = mapData.getByType('floor');
            if (floors.length > 0) {
              // First focus on the floor to get the position
              mapView.Camera.focusOn(floors[0], { duration: 1000 });
              
              // Then adjust the camera for a better viewing angle
              setTimeout(() => {
                try {
                  mapView.Camera.set({
                    bearing: 0,
                    pitch: 30, // Slight tilt for better depth perception
                    zoomLevel: 19.5, // Much closer zoom level
                  });
                  console.log('Initial camera set with zoom and tilt');
                } catch (err) {
                  console.log('Error adjusting camera angle:', err);
                }
              }, 1200);
            }
          } catch (err) {
            console.log('Error setting initial camera:', err);
          }
        }
      } catch (error) {
        console.error('Error loading stalls:', error);
      }
    };

    fetchAndPositionStalls();
  }, [mapData, mapView, focusStall]);

  // Focus on a specific stall when focusStall prop changes
  React.useEffect(() => {
    if (!mapData || !mapView || !focusStall || stallLabels.length === 0) {
      // Clear path when no stall is focused
      if (!focusStall && mapView) {
        setPathCoordinates(null);
        setHighlightedStall(null);
        setHighlightedVendorName(null);
        
        // Define section colors for restoration
        const sectionColors: { [key: string]: string } = {
          'E-': '#FF6B6B',      // Eatery - Red
          'FV-': '#4CAF50',     // Fruits & Vegetables - Green
          'DF-': '#FF9800',     // Dried Fish - Orange
          'G-': '#2196F3',      // Grocery - Blue
          'RG-': '#FFC107',     // Rice & Grains - Amber
          'V-': '#9C27B0',      // Variety - Purple
          'F-': '#00BCD4',      // Fish - Cyan
          'M-': '#F44336',      // Meat - Deep Red
        };
        
        // Restore the previous highlighted space to its section color
        if (previousHighlightedSpace) {
          try {
            // Find the previous stall's prefix to restore its section color
            const previousStallLabel = stallLabels.find(label => label.poi_id === previousHighlightedSpace.id);
            const previousColor = previousStallLabel?.prefix ? sectionColors[previousStallLabel.prefix] : undefined;
            
            mapView.updateState(previousHighlightedSpace, {
              color: previousColor,
              hoverColor: previousColor,
            });
            setPreviousHighlightedSpace(null);
          } catch (e) {
            console.log('Error restoring previous highlight:', e);
          }
        }
        
        // Clear all paths and markers from map
        try {
          mapView.Paths.removeAll();
          mapView.Markers.removeAll();
        } catch (e) {
          console.log('Error clearing paths/markers:', e);
        }
      }
      return;
    }

    // Clear previous path immediately when switching stalls
    setPathCoordinates(null);
    
    // Clear all existing paths from the map
    const clearPaths = async () => {
      try {
        await mapView.Paths.removeAll();
        await mapView.Markers.removeAll();
      } catch (error) {
        console.log('Error removing paths/markers:', error);
      }
    };
    
    clearPaths();

    console.log('Focusing on stall:', focusStall);
    
    // Find the stall label that matches
    const targetStall = stallLabels.find(label => label.name === focusStall);
    
    if (targetStall) {
      console.log('Found target stall:', targetStall);
      
      // Find the space for this stall
      const targetSpace = mapData.getByType('space').find((s: any) => s.id === targetStall.poi_id);
      
      if (targetSpace) {
        console.log('Focusing camera on stall:', focusStall);
        
        // Fetch vendor name for this stall
        const fetchVendorName = async () => {
          try {
            const { data, error } = await supabase
              .from('vendor_profiles')
              .select('business_name, first_name, last_name')
              .eq('stall_number', focusStall)
              .single();
            
            if (data && !error) {
              const vendorName = data.business_name || `${data.first_name} ${data.last_name}`;
              setHighlightedVendorName(vendorName);
            } else {
              setHighlightedVendorName(null);
            }
          } catch (error) {
            console.log('Error fetching vendor name:', error);
            setHighlightedVendorName(null);
          }
        };
        
        fetchVendorName();
        
        // Define section colors for restoration
        const sectionColors: { [key: string]: string } = {
          'E-': '#FF6B6B',      // Eatery - Red
          'FV-': '#4CAF50',     // Fruits & Vegetables - Green
          'DF-': '#FF9800',     // Dried Fish - Orange
          'G-': '#2196F3',      // Grocery - Blue
          'RG-': '#FFC107',     // Rice & Grains - Amber
          'V-': '#9C27B0',      // Variety - Purple
          'F-': '#00BCD4',      // Fish - Cyan
          'M-': '#F44336',      // Meat - Deep Red
        };
        
        // First, restore the previous highlighted space to its section color
        if (previousHighlightedSpace) {
          try {
            // Find the previous stall's prefix to restore its section color
            const previousStallLabel = stallLabels.find(label => label.poi_id === previousHighlightedSpace.id);
            const previousColor = previousStallLabel?.prefix ? sectionColors[previousStallLabel.prefix] : undefined;
            
            mapView.updateState(previousHighlightedSpace, {
              color: previousColor,
              hoverColor: previousColor,
            });
          } catch (e) {
            console.log('Error restoring previous stall color:', e);
          }
        }
        
        // Restore ALL stall colors to their section colors
        try {
          stallLabels.forEach((label) => {
            const space = mapData.getByType('space').find((s: any) => s.id === label.poi_id);
            if (space && label.prefix) {
              const color = sectionColors[label.prefix];
              if (color) {
                try {
                  mapView.updateState(space, {
                    color: color,
                    hoverColor: color,
                  });
                } catch (e) {
                  // Ignore individual errors
                }
              }
            }
          });
        } catch (error) {
          console.log('Error restoring section colors:', error);
        }
        
        // Set this stall as highlighted
        setHighlightedStall(focusStall);
        setPreviousHighlightedSpace(targetSpace);
        
        // Highlight the stall polygon with color using updateState
        try {
          mapView.updateState(targetSpace, {
            color: '#667eea', // Purple-blue color for selected stall
            hoverColor: '#764ba2', // Darker purple on hover
          });
        } catch (error) {
          console.log('Error setting polygon color:', error);
        }
        
        console.log('Highlighting stall:', focusStall);

        // Get directions from user's current location to this stall
        const getPathToStall = async () => {
          try {
            let startingPoint: any = null;

            // If we have user's GPS location, check if it's within the market bounds
            if (userLocation && mapData) {
              console.log('📍 User GPS location available:', userLocation);
              
              // Butuan Mega Market approximate center point
              // TODO: Replace with your actual market GPS coordinates
              const MARKET_CENTER = {
                lat: 8.9474,  // Replace with actual market latitude
                lng: 125.5406, // Replace with actual market longitude
              };
              
              // Calculate distance from market center (simple approximation)
              const latDiff = userLocation.latitude - MARKET_CENTER.lat;
              const lngDiff = userLocation.longitude - MARKET_CENTER.lng;
              const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
              const distanceMeters = distanceKm * 1000;
              
              // Expanded range: Use GPS if within 500 meters for outdoor-to-indoor navigation
              const isNearMarket = distanceMeters < 500;
              const isWithinMarket = distanceMeters < 100;
              
              console.log('📍 Distance from market:', distanceMeters.toFixed(0), 'meters');
              console.log('📍 GPS near market:', isNearMarket);
              console.log('📍 GPS within market bounds:', isWithinMarket);
              console.log('   User lat:', userLocation.latitude, 'lng:', userLocation.longitude);
              
              if (isNearMarket) {
                // User is near or inside the market - use GPS location for navigation
                const floors = mapData.getByType('floor');
                const currentFloor = floors[0]; // Ground floor
                
                if (currentFloor) {
                  console.log('🏢 Using floor:', currentFloor.name || currentFloor.id);
                  
                  // Create a Coordinate object from user's GPS location
                  // This supports both outdoor (when far) and indoor (when close) navigation
                  const userCoordinate = await mapView.createCoordinate({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    floorId: currentFloor.id,
                  });
                  
                  if (isWithinMarket) {
                    console.log('✅ Created coordinate from GPS (inside market):', userCoordinate);
                  } else {
                    console.log('✅ Created coordinate from GPS (outdoor, near market):', userCoordinate);
                  }
                  console.log('🎯 Will navigate from GPS location to:', targetSpace.name);
                  startingPoint = userCoordinate;
                }
              } else {
                console.log('⚠️ GPS location is outside navigation range (>500m) - will use door entrance');
                console.log('   (User is too far from the market for GPS navigation)');
              }
            } else {
              console.log('⚠️ No user location available');
              if (!userLocation) console.log('  - userLocation is null');
              if (!mapData) console.log('  - mapData is null');
            }
            
            // Fallback: If no user location, use a door as entrance
            if (!startingPoint) {
              const doors = mapData.getByType('door');
              console.log('No user location, using door. Total doors:', doors.length);
              
              if (doors.length > 0) {
                console.log('Door names:', doors.map((d: any) => d.name || d.id));
                startingPoint = doors[0];
                console.log('Using door as starting point:', (startingPoint as any).name || startingPoint.id);
              } else {
                console.log('No doors found - cannot show path');
                setPathCoordinates(null);
                return;
              }
            }

            if (startingPoint) {
              // Get directions from starting point to target stall
              const directions = await mapView.getDirections(startingPoint, targetSpace);
              
              if (directions && directions.coordinates && directions.coordinates.length > 0) {
                // Store the path coordinates for rendering
                setPathCoordinates(directions.coordinates);
                
                // Zoom out camera to show the entire path from start to destination
                try {
                  // Focus on the entire floor to show the complete navigation path
                  const floors = mapData.getByType('floor');
                  if (floors.length > 0) {
                    // This will zoom out to show the whole market floor with the path visible
                    mapView.Camera.focusOn(floors[0]);
                  } else {
                    // Fallback to destination if no floor found
                    mapView.Camera.focusOn(targetSpace);
                  }
                } catch (error) {
                  mapView.Camera.focusOn(targetSpace);
                }
              } else {
                // If GPS coordinate failed to route, fall back to door
                const isGPSCoordinate = (startingPoint as any).__type === 'coordinate';
                if (isGPSCoordinate) {
                  const doors = mapData.getByType('door');
                  if (doors.length > 0) {
                    const doorDirections = await mapView.getDirections(doors[0], targetSpace);
                    
                    if (doorDirections && doorDirections.coordinates && doorDirections.coordinates.length > 0) {
                      setPathCoordinates(doorDirections.coordinates);
                    } else {
                      setPathCoordinates(null);
                    }
                  } else {
                    setPathCoordinates(null);
                  }
                } else {
                  setPathCoordinates(null);
                }
              }
            } else {
              console.log('No doors found - cannot show path');
              setPathCoordinates(null);
            }
          } catch (error) {
            console.error('Error getting directions:', error);
            setPathCoordinates(null);
          }
        };

        getPathToStall();
      }
    } else {
      console.log('Stall not found in labels:', focusStall);
    }
  }, [mapData, mapView, focusStall, stallLabels, userLocation, previousHighlightedSpace]);

  // Automatically recalculate path when GPS location is found
  React.useEffect(() => {
    if (!userLocation || !highlightedStall || !mapData || !mapView || stallLabels.length === 0) {
      return;
    }

    console.log('🔄 GPS location found! Recalculating path to:', highlightedStall);
    
    // Find the highlighted stall
    const targetStall = stallLabels.find(label => label.name === highlightedStall);
    
    if (!targetStall) {
      console.log('⚠️ Highlighted stall not found in labels');
      return;
    }

    // Find the space for this stall
    const targetSpace = mapData.getByType('space').find((s: any) => s.id === targetStall.poi_id);
    
    if (!targetSpace) {
      console.log('⚠️ Target space not found for stall');
      return;
    }

    // Recalculate path from GPS location
    const recalculatePath = async () => {
      try {
        console.log('📍 Checking GPS location:', userLocation.latitude, userLocation.longitude);
        
        // Butuan Mega Market approximate center point
        const MARKET_CENTER = {
          lat: 8.9474,  // Replace with actual market latitude
          lng: 125.5406, // Replace with actual market longitude
        };
        
        // Calculate distance from market center
        const latDiff = userLocation.latitude - MARKET_CENTER.lat;
        const lngDiff = userLocation.longitude - MARKET_CENTER.lng;
        const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
        const distanceMeters = distanceKm * 1000;
        
        // Only use GPS if within 100 meters of market
        const isWithinMarket = distanceMeters < 100;
        
        console.log('📍 Distance from market:', distanceMeters.toFixed(0), 'meters');
        console.log('📍 GPS within market bounds:', isWithinMarket);
        
        if (!isWithinMarket) {
          console.log('⚠️ GPS location is outside market - not recalculating path');
          console.log('   Path will continue using door entrance');
          return;
        }
        
        console.log('🔄 Recalculating from GPS location (inside market)');
        
        // Get the current floor
        const floors = mapData.getByType('floor');
        const currentFloor = floors[0];
        
        if (currentFloor) {
          console.log('🏢 Using floor:', currentFloor.id);
          
          // Create coordinate from GPS location using mapView.Coordinate
          const userCoordinate = await mapView.createCoordinate({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            floorId: currentFloor.id,
          });
          
          console.log('✅ GPS coordinate created for pathfinding');
          
          // Get directions from GPS location to target stall
          console.log('🎯 Getting directions to:', highlightedStall);
          const directions = await mapView.getDirections(userCoordinate, targetSpace);
          
          if (directions && directions.coordinates && directions.coordinates.length > 0) {
            console.log('✅ Path recalculated from GPS!', directions.coordinates.length, 'coordinates');
            console.log('📏 Distance:', directions.distance, 'meters');
            setPathCoordinates(directions.coordinates);
          } else {
            console.log('⚠️ No path found from GPS location - falling back to door entrance');
            
            // Fall back to door entrance
            const doors = mapData.getByType('object').filter((obj: any) => 
              obj.name && obj.name.toLowerCase().includes('door')
            );

            if (doors.length > 0) {
              console.log('🚪 Using door entrance as fallback');
              const doorDirections = await mapView.getDirections(doors[0], targetSpace);
              
              if (doorDirections && doorDirections.coordinates) {
                console.log('✅ Path created from door entrance');
                setPathCoordinates(doorDirections.coordinates);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error recalculating path from GPS:', error);
        
        // Try fallback to door entrance on error
        try {
          const doors = mapData.getByType('object').filter((obj: any) => 
            obj.name && obj.name.toLowerCase().includes('door')
          );

          if (doors.length > 0) {
            console.log('🚪 Error recovery: Using door entrance');
            const doorDirections = await mapView.getDirections(doors[0], targetSpace);
            
            if (doorDirections && doorDirections.coordinates) {
              setPathCoordinates(doorDirections.coordinates);
            }
          }
        } catch (fallbackError) {
          console.error('❌ Fallback to door also failed:', fallbackError);
        }
      }
    };

    recalculatePath();
  }, [userLocation, highlightedStall, mapData, mapView, stallLabels]);

  if (!mapData) return null;

  // Render labels using Mappedin Marker component
  return (
    <>
      {/* Location Permission Modal */}
      <LocationPermissionModal
        visible={showLocationModal}
        onRequestPermission={handleRequestPermission}
        onDeny={handleDenyPermission}
      />

      {/* Render pathfinding line with gradient effect */}
      {pathCoordinates && pathCoordinates.length > 0 && (
        <Path
          key={`path-${highlightedStall}`}
          coordinate={pathCoordinates}
          options={{
            color: '#667eea', // Purple-blue to match focused stall
            width: 3,
            pulseIterations: 3,
            displayArrowsOnPath: true,
            animateArrowsOnPath: true,
          }}
          onLoad={(path) => {
            console.log('Path loaded successfully:', path);
          }}
          onDrawComplete={() => {
            console.log('Path drawing complete');
          }}
        />
      )}
      
      {/* Render small vendor name labels for selected category */}
      {!highlightedStall && categoryVendors.map((vendor) => {
        const space = mapData.getByType('space').find((s: any) => 
          s.id === vendor.poi_id
        );
        
        if (!space) return null;

        // Small labels for category view
        return (
          <Marker
            key={`category-vendor-${vendor.stallNumber}`}
            target={space}
            html={`<div style="
              background: rgba(255, 255, 255, 0.95); 
              color: #333; 
              padding: 4px 8px; 
              border-radius: 4px; 
              font-size: 11px; 
              font-weight: 600; 
              border: 1px solid #ddd; 
              white-space: nowrap; 
              line-height: 1.2;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              max-width: 120px;
              overflow: hidden;
              text-overflow: ellipsis;
            ">${vendor.vendorName}</div>
            `}
            options={{
              rank: 'always-visible',
            }}
          />
        );
      })}
      
      {/* Render labels - only show focused stall label */}
      {highlightedStall && (() => {
        const targetLabel = stallLabels.find(label => label.name === highlightedStall);
        
        if (!targetLabel) return null;
        
        const space = mapData.getByType('space').find((s: any) => 
          s.externalId === targetLabel.poi_id || s.id === targetLabel.poi_id
        );
        
        if (!space) return null;

        // Use vendor name if available, otherwise use stall number
        const displayName = highlightedVendorName || targetLabel.name;

        // Focused stall - clean white label with shadow
        const backgroundColor = '#ffffff';
        const textColor = '#667eea';
        const borderColor = '#667eea';
        const fontSize = '16px';
        const padding = '8px 16px';
        const boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 2px #667eea';

        return (
          <Marker
            key={`marker-${highlightedStall}-${highlightedVendorName || 'default'}`}
            target={space}
            html={`<div style="
              background: ${backgroundColor}; 
              color: ${textColor}; 
              padding: ${padding}; 
              border-radius: 8px; 
              font-size: ${fontSize}; 
              font-weight: 700; 
              border: 2px solid ${borderColor}; 
              white-space: nowrap; 
              line-height: 1.3;
              box-shadow: ${boxShadow};
              letter-spacing: 0.5px;
            ">${displayName}</div>
            `}
            options={{
              rank: 'always-visible',
            }}
          />
        );
      })()}
    </>
  );
};

const MapViewComponent: React.FC<MapViewComponentProps> = ({ onLocationSelect: _onLocationSelect, selectedCategory: _selectedCategory, onStallClick: _onStallClick, onVendorClick, focusStall }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoize credentials to prevent re-creation on every render
  const credentials = useMemo(() => ({
    key: 'mik_M8uMQcxJZDWRbwmrR542e07af',
    secret: 'mis_4sDELo8xqkrXxLMPEUXzDQsf71J3bvI1UhbUVcWm3WW8dfa102e',
    mapId: '68ee9141b47af0000bc138c1',
  }), []);

  // Map options - Modern gradient design with outdoor navigation
  const mapOptions = useMemo(() => ({
    backgroundColor: '#E8F5E9', // Light green/mint background
    outdoorView: {
      enabled: true, // Enable outdoor view for indoor-to-outdoor navigation
    },
    shadowColor: '#2E7D32', // Dark green shadows for depth
    multiBufferRendering: false,
    labelAllLocationsOnInit: false,
    xRayPath: false,
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
        <MapContent 
          selectedCategory={_selectedCategory} 
          onVendorClick={onVendorClick}
          focusStall={focusStall}
        />
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
  gpsStatusContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  gpsStatusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  gpsSearching: {
    backgroundColor: '#FF9800',
  },
  gpsFound: {
    backgroundColor: '#4CAF50',
  },
  gpsStatusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  gpsCoordinates: {
    color: '#fff',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.9,
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#666',
    fontWeight: 'bold',
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  modalRow: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  modalValue: {
    fontSize: 16,
    color: '#333',
  },
  modalSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 12,
  },
  noVendorText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
});

export default React.memo(MapViewComponent);