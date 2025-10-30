import React, { useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

interface MapViewWebProps {
  onLocationSelect?: (locationId: string, locationName: string, locationData?: any) => void;
  selectedCategory?: string;
}

const MapViewWeb: React.FC<MapViewWebProps> = ({ onLocationSelect }) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // HTML with Mappedin Web SDK that supports clicking
  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  
  <script type="module">
    import { getVenue, showVenue } from 'https://d1p5cqqchvbqmy.cloudfront.net/web-sdk/v6/esm/index.js';
    
    (async function() {
      try {
        console.log('Loading map...');
        
        // Get venue data
        const venue = await getVenue({
          venue: '68ee9141b47af0000bc138c1',
          clientId: 'mik_M8uMQcxJZDWRbwmrR542e07af',
          clientSecret: 'mis_4sDELo8xqkrXxLMPEUXzDQsf71J3bvI1UhbUVcWm3WW8dfa102e'
        });
        
        console.log('Venue loaded, showing map...');
        
        // Show venue
        const mapView = await showVenue(document.getElementById('map'), venue, {
          backgroundColor: '#f5f5f5'
        });
        
        console.log('Map loaded successfully');
        const spaces = venue.locations.filter(loc => loc.type === 'space');
        
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'mapReady',
          spaces: spaces.length
        }));
        
        console.log('Total spaces:', spaces.length);
        
        // Make all spaces clickable
        spaces.forEach(space => {
          try {
            mapView.Polygons.add(space, {
              interactive: true,
              color: 'rgba(0, 122, 255, 0.1)',
              hoverColor: 'rgba(0, 122, 255, 0.3)'
            });
          } catch (e) {
            // Silently fail for spaces without polygons
          }
        });
        
        // Handle clicks
        mapView.on('click', (event) => {
          console.log('Click event:', event);
          
          if (event.polygons && event.polygons.length > 0) {
            const polygon = event.polygons[0];
            const space = polygon.location;
            
            console.log('Space clicked:', space.name);
            
            // Send to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'spaceClick',
              spaceId: space.id,
              spaceName: space.name,
              space: {
                id: space.id,
                name: space.name
              }
            }));
          }
        });
        
      } catch (error) {
        console.error('Map error:', error);
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'error',
          message: error.message || String(error)
        }));
      }
    })();
  </script>
</body>
</html>
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('WebView message:', data);
      
      switch (data.type) {
        case 'mapReady':
          console.log('Map ready with', data.spaces, 'spaces');
          setLoading(false);
          break;
          
        case 'spaceClick':
          console.log('Space clicked:', data.spaceName);
          if (onLocationSelect) {
            onLocationSelect(data.spaceId, data.spaceName, data.space);
          }
          break;
          
        case 'error':
          console.error('Map error:', data.message);
          setError(data.message);
          setLoading(false);
          break;
      }
    } catch (err) {
      console.error('Error parsing WebView message:', err);
    }
  };

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
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={styles.webview}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setError('Failed to load map');
          setLoading(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
});

export default MapViewWeb;
