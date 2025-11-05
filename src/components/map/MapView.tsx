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
  const [userMapCoordinate, setUserMapCoordinate] = useState<any>(null);
  const hasInitiallyFocusedRef = useRef(false); // Track if we've focused on user location initially
  // Entrance selector and manual position feature removed

  // Debug modal state removed - now using navigation instead

  // Market entrance positions (approximate coordinates based on map layout)
  const MARKET_ENTRANCES = useMemo(() => [
    { id: 'e1', name: 'Entrance/Exit 1', lat: 7.01845179, lng: 125.49598357, description: 'User-provided' },
    { id: 'e2', name: 'Entrance/Exit 2', lat: 7.01810893, lng: 125.49607863, description: 'User-provided' },
    { id: 'e3', name: 'Entrance/Exit 3', lat: 7.01804035, lng: 125.49591554, description: 'User-provided' },
    { id: 'e4', name: 'Entrance/Exit 4', lat: 7.01802759, lng: 125.49581658, description: 'User-provided' },
    { id: 'e5', name: 'Entrance/Exit 5', lat: 7.01836498, lng: 125.49572210, description: 'User-provided' },
    { id: 'e6', name: 'Entrance/Exit 6', lat: 7.01878521, lng: 125.49560490, description: 'User-provided' },
    { id: 'e7', name: 'Entrance/Exit 7', lat: 7.01881347, lng: 125.49568865, description: 'User-provided' },
    { id: 'e8', name: 'Entrance/Exit 8', lat: 7.01884416, lng: 125.49579819, description: 'User-provided' },
    { id: 'e9', name: 'Entrance/Exit 9', lat: 7.01884789, lng: 125.49587464, description: 'User-provided' },
  ], []);

  // Helper: choose the best fallback start (prefer nearest provided entrances; then try doors)
  const getBestFallbackStart = useCallback(async (targetSpace: any) => {
    if (!mapView || !mapData || !targetSpace) return null;

    // 1) Prefer entrances provided by the user. Build a coordinate for each and pick the shortest route
    try {
      const floors = mapData.getByType('floor');
      if (floors && floors.length > 0) {
        // Try to use the same floor as the target space when possible
        const targetFloorId = (targetSpace as any)?.floorId || (targetSpace as any)?.floor?.id || floors[0].id;

        let bestCoord: any = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const entrance of MARKET_ENTRANCES) {
          try {
            const coord = await mapView.createCoordinate({
              latitude: entrance.lat,
              longitude: entrance.lng,
              floorId: targetFloorId,
            });
            const dir = await mapView.getDirections(coord, targetSpace);
            const dist = (dir && typeof dir.distance === 'number') ? dir.distance : Number.POSITIVE_INFINITY;
            if (dist < bestDist) {
              bestDist = dist;
              bestCoord = coord;
            }
          } catch {}
        }
        if (bestCoord) return bestCoord;
      }
    } catch {}

    // 2) Fall back to doors (type or name-matched), choose closest by distance with heuristics
    try {
      const typedDoors = (() => { try { return mapData.getByType('door'); } catch { return []; } })() as any[];
      const namedDoorObjects = (() => { try { return mapData.getByType('object'); } catch { return []; } })()
        .filter((obj: any) => obj && obj.name && /door|entrance/i.test(obj.name)) as any[];

      const seen = new Set<string>();
      const doorCandidates: any[] = [];
      [...typedDoors, ...namedDoorObjects].forEach((d: any) => {
        const id = (d && (d.id ?? d.externalId)) || Math.random().toString(36);
        if (!seen.has(id)) { seen.add(id); doorCandidates.push(d); }
      });

      if (doorCandidates.length > 0) {
        let bestDoor: any = null;
        let bestScoreTuple: [number, number] | null = null; // [-priority, distance]
        for (const door of doorCandidates) {
          try {
            const name = String((door as any).name || '').toLowerCase();
            let priority = 0;
            if (/double/.test(name)) priority += 1000;
            if (/swing/.test(name)) priority += 500;
            if (/entrance/.test(name)) priority += 300;
            if (/main/.test(name)) priority += 100;
            const dir = await mapView.getDirections(door, targetSpace);
            const dist = (dir && typeof dir.distance === 'number') ? dir.distance : Number.POSITIVE_INFINITY;
            const scoreTuple: [number, number] = [-priority, dist];
            if (!bestScoreTuple || scoreTuple[0] < bestScoreTuple[0] || (scoreTuple[0] === bestScoreTuple[0] && scoreTuple[1] < bestScoreTuple[1])) {
              bestScoreTuple = scoreTuple; bestDoor = door;
            }
          } catch {}
        }
        if (bestDoor) return bestDoor;
      }
    } catch {}

    return null;
  }, [mapView, mapData, MARKET_ENTRANCES]);

  // Manual 'Set My Location' feature removed

  const startLocationTracking = React.useCallback(() => {
    // Toril Public Market coordinates (7°1'6"N, 125°29'44"E)
    const MARKET_CENTER = {
      lat: 7.018333,
      lng: 125.495556,
    };
    
    const validateLocation = (latitude: number, longitude: number): boolean => {
      // Calculate distance from market center
      const latDiff = latitude - MARKET_CENTER.lat;
      const lngDiff = longitude - MARKET_CENTER.lng;
      const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
      const distanceMeters = distanceKm * 1000;
      
      // Only accept GPS if within 200 meters of market (increased for outdoor -> indoor transition)
      return distanceMeters < 200;
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    // Watch position for continuous updates with high accuracy
    const watchId = Geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        console.log('📍 Location updated:', lat, lng);
        console.log('📍 Accuracy:', acc, 'meters');

        // Validate location before accepting it (avoid stale/far coordinates)
        if (validateLocation(lat, lng)) {
          setUserLocation({ latitude: lat, longitude: lng });
          if (gpsStatus !== 'found') {
            setGpsStatus('found');
          }
        } else {
          console.log('⚠️ GPS update outside market bounds or stale; ignoring and clearing user location');
          setUserLocation(null);
          if (gpsStatus !== null) setGpsStatus(null);
        }
      },
      (error) => {
        console.error('Error watching location:', error);
      },
      { 
        enableHighAccuracy: true, 
        distanceFilter: 2, // Update every 2 meters for better accuracy
        interval: 1000, // Request updates every second
        fastestInterval: 500 // Allow updates as fast as 500ms
      }
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

  // Handle space clicks - show path and navigate to vendor details
  React.useEffect(() => {
    if (!mapView || !mapData) return;

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
        
        if (clickedStall) {
          // First, show the path from user's location to this stall
          try {
            console.log('🗺️ Drawing path to stall:', clickedStall.name);
            console.log('🔍 userMapCoordinate available?', userMapCoordinate ? 'YES' : 'NO');
            console.log('🔍 userLocation available?', userLocation ? 'YES' : 'NO');
            
            let startingPoint: any = null;

            // Use the blue dot location (userMapCoordinate) if available
            if (userMapCoordinate) {
              console.log('✅ Using blue dot (userMapCoordinate) as starting point');
              console.log('📍 userMapCoordinate:', JSON.stringify(userMapCoordinate));
              startingPoint = userMapCoordinate;
            } else {
              console.log('⚠️ No blue dot available, using door entrance');
              // Fallback: If no user location, use door entrance
              const doors = mapData.getByType('door');
              if (doors.length > 0) {
                startingPoint = doors[0];
                console.log('🚪 Using door as starting point:', doors[0].name || doors[0].id);
              }
            }

            // Get directions from starting point to clicked stall
            if (startingPoint) {
              const directions = await mapView.getDirections(startingPoint, clickedSpace);
              
              if (directions && directions.coordinates && directions.coordinates.length > 0) {
                console.log('✅ Path found with', directions.coordinates.length, 'coordinates');
                setPathCoordinates(directions.coordinates);
                setHighlightedStall(clickedStall.name);
                
                // Highlight the clicked stall
                const sectionColors: { [key: string]: string } = {
                  'E-': '#FF6B6B', 'FV-': '#4CAF50', 'DF-': '#FF9800', 'G-': '#2196F3',
                  'RG-': '#FFC107', 'V-': '#9C27B0', 'F-': '#00BCD4', 'M-': '#F44336',
                };
                
                // Restore previous highlight
                if (previousHighlightedSpace) {
                  const previousStallLabel = stallLabels.find(label => label.poi_id === previousHighlightedSpace.id);
                  const previousColor = previousStallLabel?.prefix ? sectionColors[previousStallLabel.prefix] : undefined;
                  
                  mapView.updateState(previousHighlightedSpace, {
                    color: previousColor,
                    hoverColor: previousColor,
                  });
                }
                
                // Highlight current stall
                mapView.updateState(clickedSpace, {
                  color: '#667eea',
                  hoverColor: '#764ba2',
                });
                
                setPreviousHighlightedSpace(clickedSpace);

                // Fit camera to show both the start and the destination
                try {
                  mapView.Camera.focusOn([startingPoint, clickedSpace]);
                } catch (e) {
                  try { mapView.Camera.focusOn(clickedSpace); } catch {}
                }
              } else {
                console.log('⚠️ No path found');
              }
            }
          } catch (err) {
            console.error('💥 Error drawing path:', err);
          }
          
          // Then navigate to vendor details if callback provided
          if (onVendorClick) {
            console.log('🔍 Fetching vendor for stall:', clickedStall.name);
            
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
                console.log('⚠️ No vendor found for stall:', clickedStall.name);
                onVendorClick(clickedStall.name);
              }
            } catch (err) {
              console.error('💥 Error fetching vendor:', err);
            }
          }
        } else {
          console.log('⚠️ Stall not found in stallLabels');
        }
      } else {
        console.log('⚠️ No spaces in click event');
      }
    };

    mapView.on('click', handleClick);

    return () => {
      mapView.off('click', handleClick);
    };
  }, [mapView, mapData, stallLabels, onVendorClick, userMapCoordinate, userLocation, previousHighlightedSpace]);

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

  // Convert user GPS location to map coordinate for blue dot display
  React.useEffect(() => {
    const convertUserLocationToMapCoordinate = async () => {
      if (!mapView || !mapData || !userLocation) {
        setUserMapCoordinate(null);
        return;
      }

      try {
        const floors = mapData.getByType('floor');
        if (floors && floors.length > 0) {
          const currentFloor = floors[0];
          
          // Create a Coordinate object from user's GPS location
          const coordinate = await mapView.createCoordinate({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            floorId: currentFloor.id,
          });
          
          setUserMapCoordinate(coordinate);
          console.log('📍 User location converted to map coordinate');
          
          // Focus camera on user's location ONLY on first GPS lock
          // Only do this if no stall is currently highlighted
          if (!highlightedStall && !hasInitiallyFocusedRef.current) {
            console.log('📷 Focusing camera on user location (initial focus)');
            hasInitiallyFocusedRef.current = true;
            mapView.Camera.focusOn(coordinate);
          }
        }
      } catch (error) {
        console.log('Error converting GPS to map coordinate:', error);
        setUserMapCoordinate(null);
      }
    };

    convertUserLocationToMapCoordinate();
  }, [mapView, mapData, userLocation, highlightedStall]);

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

            // Use the blue dot location (userMapCoordinate) if available
            if (userMapCoordinate) {
              console.log('✅ Using blue dot (userMapCoordinate) for focusStall navigation');
              startingPoint = userMapCoordinate;
            } else {
              console.log('⚠️ No blue dot available for focusStall, using door entrance');
            }
            
            // Fallback: If no user location, pick best door/entrance by route distance
            if (!startingPoint) {
              const fallback = await getBestFallbackStart(targetSpace);
              if (!fallback) {
                console.log('No suitable starting point found - cannot show path');
                setPathCoordinates(null);
                return;
              }
              startingPoint = fallback;
            }

            if (startingPoint) {
              // Get directions from starting point to target stall
              const directions = await mapView.getDirections(startingPoint, targetSpace);
              
              if (directions && directions.coordinates && directions.coordinates.length > 0) {
                // Store the path coordinates for rendering
                setPathCoordinates(directions.coordinates);
                
                // Fit camera to show both start and destination so the blue path is readable
                try {
                  mapView.Camera.focusOn([startingPoint, targetSpace]);
                } catch (e) {
                  try { mapView.Camera.focusOn(targetSpace); } catch {}
                }
              } else {
                // If GPS coordinate failed to route, fall back to best door/entrance coordinate
                const isGPSCoordinate = (startingPoint as any).__type === 'coordinate';
                if (isGPSCoordinate) {
                  const fallbackStart = await getBestFallbackStart(targetSpace);
                  if (fallbackStart) {
                    const doorDirections = await mapView.getDirections(fallbackStart, targetSpace);
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
  }, [mapData, mapView, focusStall, stallLabels, userMapCoordinate, previousHighlightedSpace, getBestFallbackStart]);

  // Automatically recalculate path when GPS location changes (blue dot moves)
  React.useEffect(() => {
    if (!userMapCoordinate || !highlightedStall || !mapData || !mapView || stallLabels.length === 0) {
      return;
    }

    console.log('🔄 GPS location updated! Recalculating path to:', highlightedStall);
    
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

    // Recalculate path from current GPS location (blue dot)
    const recalculatePath = async () => {
      try {
        console.log('� Recalculating path from blue dot to:', highlightedStall);
        
        // Get directions from blue dot location to target stall
        const directions = await mapView.getDirections(userMapCoordinate, targetSpace);
        
        if (directions && directions.coordinates && directions.coordinates.length > 0) {
          console.log('✅ Path updated!', directions.coordinates.length, 'coordinates');
          console.log('📏 Distance remaining:', directions.distance?.toFixed(1), 'meters');
          setPathCoordinates(directions.coordinates);
        } else {
          console.log('⚠️ No path found from current location');
          
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
  }, [userMapCoordinate, highlightedStall, mapData, mapView, stallLabels]);

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

      {/* Manual 'Set My Location' UI removed */}

      {/* Render pathfinding line (blue navigation path) */}
      {pathCoordinates && pathCoordinates.length > 0 && (
        <Path
          key={`path-${highlightedStall}`}
          coordinate={pathCoordinates}
          options={{
            color: '#2196F3', // Blue line for navigation
            width: 1.1,
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

      {/* User Location Blue Dot - displayed as a Marker on the map */}
      {userMapCoordinate && (
        <Marker
          key="user-location-marker"
          target={userMapCoordinate}
          html={`
            <div style="position: relative; width: 24px; height: 24px;">
              <div style="
                position: absolute;
                width: 24px;
                height: 24px;
                border-radius: 12px;
                background-color: rgba(33, 150, 243, 0.3);
                top: 0;
                left: 0;
                animation: pulse 2s ease-in-out infinite;
              "></div>
              <div style="
                position: absolute;
                width: 16px;
                height: 16px;
                border-radius: 8px;
                background-color: #2196F3;
                top: 4px;
                left: 4px;
                border: 3px solid #FFFFFF;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
              "></div>
              <style>
                @keyframes pulse {
                  0%, 100% { transform: scale(1); opacity: 0.6; }
                  50% { transform: scale(1.3); opacity: 0.3; }
                }
              </style>
            </div>
          `}
          options={{
            rank: 'always-visible',
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
  entranceIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  entranceTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  entranceDescription: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  entranceDistance: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
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
  setLocationButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 999,
  },
  setLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  entranceSelectorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  entranceSelectorModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  entranceSelectorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  entranceSelectorSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  entranceButton: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  entranceButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 4,
  },
  entranceButtonDesc: {
    fontSize: 13,
    color: '#666',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});

export default React.memo(MapViewComponent);