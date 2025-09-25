import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Figma design dimensions
const FIGMA_WIDTH = 412;
const FIGMA_HEIGHT = 917;
const MAP_WIDTH = 2300; // Perfect width for horizontal scrolling
const MAP_HEIGHT = 800;

// Define stall data structure
interface StallData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: 'meat' | 'fish' | 'vegetable' | 'general' | 'retail' | 'dry-food' | 'entrance' | 'vendor' | 'admin';
  isOccupied: boolean;
  vendorName?: string;
  products?: string[];
}

interface IndoorMarketMapProps {
  onStallPress?: (stall: StallData) => void;
  selectedStallId?: string;
}

const IndoorMarketMap: React.FC<IndoorMarketMapProps> = ({ onStallPress, selectedStallId }) => {
  // Calculate scale to fit Figma design - make map wider for horizontal scrolling
  const scaleX = SCREEN_WIDTH / FIGMA_WIDTH;
  const scaleY = (SCREEN_HEIGHT - 100) / FIGMA_HEIGHT; // Account for header
  const scale = Math.min(scaleX, scaleY);

  // Map dimensions - now wide enough for horizontal scrolling
  const containerWidth = MAP_WIDTH * scale;
  const containerHeight = MAP_HEIGHT * scale;

  // Debug: Log dimensions to see if map is wider than screen
  console.log('Screen width:', SCREEN_WIDTH);
  console.log('Map width:', containerWidth);
  console.log('Scale:', scale);

  // Simple scroll state - no zoom functionality
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const SCALED_MAP_WIDTH = containerWidth;
  const SCALED_MAP_HEIGHT = containerHeight;

  // State for UI
  const [selectedStall, setSelectedStall] = useState<string | null>(selectedStallId || null);

  // Simple scroll functionality - no zoom, just natural scrolling

  // Helper function to handle stall press
  const handleStallPress = (stallData: StallData) => {
    setSelectedStall(stallData.id);
    if (onStallPress) {
      onStallPress(stallData);
    }
  };

  // Helper function to render stalls with proper scaling and click functionality
  const renderStall = (id: string, x: number, y: number, width: number, height: number, label: string, type?: StallData['type'], isOccupied: boolean = true, vendorName?: string, products?: string[]) => {
    const stallData: StallData = {
      id,
      x,
      y,
      width,
      height,
      label,
      type: type || 'general',
      isOccupied,
      vendorName,
      products
    };

    const isSelected = selectedStall === id;

    return (
      <TouchableOpacity
        key={id}
        style={{
          position: 'absolute',
          left: x * scale,
          top: y * scale,
          width: width * scale,
          height: height * scale,
          backgroundColor: isSelected ? '#4CAF50' : (isOccupied ? '#ACACAC' : '#E0E0E0'),
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? '#2E7D32' : 'black',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2.5 * scale,
          borderRadius: 2,
        }}
        onPress={() => handleStallPress(stallData)}
        activeOpacity={0.7}
      >
        <Text style={{
          fontSize: 16 * scale,
          textAlign: 'center',
          color: isSelected ? 'white' : 'black',
          lineHeight: 18 * scale,
          fontWeight: 'bold'
        }}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };


  // No animated styles needed - using natural ScrollView

  // Helper function to render areas with exact Figma dimensions
  const renderArea = (id: string, x: number, y: number, width: number, height: number, label: string) => (
    <View
      key={id}
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        backgroundColor: '#ACACAC',
        borderWidth: 1,
        borderColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2.5 * scale,
      }}
    >
      <Text style={{
        fontSize: 16 * scale,
        textAlign: 'center',
        color: 'black',
        lineHeight: 18 * scale,
        fontWeight: 'bold'
      }}>
        {label}
      </Text>
    </View>
  );



  return (
    <View style={styles.container}>
      {/* Map Container with natural scrolling */}
      <ScrollView
        style={styles.mapContainer}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEventThrottle={16}
        contentContainerStyle={{
          width: containerWidth,
        }}
        nestedScrollEnabled={true}
        directionalLockEnabled={false}
      >
        <ScrollView
          style={{ height: containerHeight }}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={true}
          scrollEventThrottle={16}
          contentContainerStyle={{
            height: containerHeight,
          }}
        >
          <View
            style={{
              width: containerWidth,
              height: containerHeight,
              backgroundColor: '#D9D9D9',
              borderWidth: 2,
              borderColor: '#666666',
            }}
          >
            {/* Administrative Areas - Exact Figma coordinates */}
            {renderArea('ceeo', 77.54, 71.34, 114.77, 134.93, 'CITY\nECONOMIC\nENTERPRISE\nOFFICE')}
            {renderArea('cto', 192.31, 71.34, 57.38, 134.93, 'C\nT\nO')}
            {renderArea('breaker-room', 249.7, 71.34, 57.38, 134.93, 'BREAKER ROOM')}

            {/* Empty Stalls (no labels) - Removed the small box sticking to F 59 */}

            {/* M Stalls (Meat/General) - Left Section - Exact Figma coordinates */}
            {renderStall('m67', 77.54, 246.59, 51.18, 37.22, 'M 67', 'meat', true, 'Juan\'s Meat Shop', ['Beef', 'Pork', 'Chicken'])}
            {renderStall('m61', 128.73, 246.59, 51.18, 37.22, 'M 61', 'meat', true, 'Maria\'s Butchery', ['Beef', 'Pork'])}
            {renderStall('m68', 77.55, 283.82, 51.18, 37.22, 'M 68', 'meat', false)}
            {renderStall('m62', 128.73, 283.82, 51.18, 37.22, 'M 62', 'meat', true, 'Pedro\'s Fresh Meat', ['Chicken', 'Beef'])}

            {/* M Stalls - Right Section - Exact Figma coordinates */}
            {renderStall('m7', 777.01, 246.59, 51.18, 37.22, 'M 7')}
            {renderStall('m1', 828.19, 246.59, 51.18, 37.22, 'M\n1')}
            {renderStall('m8', 777.01, 283.82, 51.18, 37.22, 'M 8')}
            {renderStall('m2', 828.19, 283.82, 51.18, 37.22, 'M 2')}

            {renderStall('m9', 777.01, 353.61, 51.18, 37.22, 'M 9')}
            {renderStall('m3', 828.19, 353.61, 51.18, 37.22, 'M 3')}
            {renderStall('m10', 777.01, 390.83, 51.18, 37.22, 'M 10')}
            {renderStall('m4', 828.19, 390.83, 51.18, 37.22, 'M 4')}

            {renderStall('m11', 777.01, 460.62, 51.18, 37.22, 'M 11')}
            {renderStall('m5', 828.19, 460.62, 51.18, 37.22, 'M 5')}
            {renderStall('m12', 777.01, 497.84, 51.18, 37.22, 'M 12')}
            {renderStall('m6', 828.19, 497.84, 51.18, 37.22, 'M 6')}

            {/* F Stalls (Fish section) - Row 1 - Exact Figma coordinates */}
            {renderStall('f1', 1415.98, 246.59, 51.18, 37.22, 'F\n1', 'fish', true, 'Fresh Catch', ['Tuna', 'Salmon', 'Tilapia'])}
            {renderStall('f2', 1467.16, 246.59, 51.18, 37.22, 'F\n2', 'fish', true, 'Ocean Delights', ['Shrimp', 'Crab', 'Lobster'])}
            {renderStall('f24', 1415.98, 283.82, 51.18, 37.22, 'F\n24', 'fish', false)}
            {renderStall('f23', 1467.16, 283.82, 51.18, 37.22, 'F\n23', 'fish', true, 'Sea Fresh', ['Mackerel', 'Sardines'])}

            {/* F Stalls - Row 2 - Exact Figma coordinates */}
            {renderStall('f3', 1555.56, 246.59, 51.18, 37.22, 'F\n3')}
            {renderStall('f4', 1606.74, 246.59, 51.18, 37.22, 'F\n4')}
            {renderStall('f22', 1555.56, 283.82, 51.18, 37.22, 'F\n22')}
            {renderStall('f21', 1606.74, 283.82, 51.18, 37.22, 'F\n21')}

            {/* F Stalls - Row 3 - Exact Figma coordinates */}
            {renderStall('f5', 1695.15, 246.59, 51.18, 37.22, 'F\n5')}
            {renderStall('f6', 1746.33, 246.59, 51.18, 37.22, 'F\n6')}
            {renderStall('f20', 1695.15, 283.82, 51.18, 37.22, 'F\n20')}
            {renderStall('f19', 1746.33, 283.82, 51.18, 37.22, 'F\n19')}

            {/* F Stalls - Row 4 - Exact Figma coordinates */}
            {renderStall('f7', 1834.73, 246.59, 51.18, 37.22, 'F\n7')}
            {renderStall('f8', 1885.91, 246.59, 51.18, 37.22, 'F\n8')}
            {renderStall('f18', 1834.73, 283.82, 51.18, 37.22, 'F\n18')}
            {renderStall('f17', 1885.91, 283.82, 51.18, 37.22, 'F\n17')}

            {/* F Stalls - Row 5 - Exact Figma coordinates */}
            {renderStall('f9', 1974.31, 246.59, 51.18, 37.22, 'F\n9')}
            {renderStall('f10', 2025.49, 246.59, 51.18, 37.22, 'F\n10')}
            {renderStall('f16', 1974.31, 283.82, 51.18, 37.22, 'F\n16')}
            {renderStall('f15', 2025.49, 283.82, 51.18, 37.22, 'F\n15')}

            {/* F Stalls - Row 6 - Exact Figma coordinates */}
            {renderStall('f11', 2116.99, 246.59, 51.18, 37.22, 'F\n11')}
            {renderStall('f12', 2168.17, 246.59, 51.18, 37.22, 'F\n12')}
            {renderStall('f14', 2116.99, 283.82, 51.18, 37.22, 'F\n14')}
            {renderStall('f13', 2168.17, 283.82, 51.18, 37.22, 'F\n13')}

            {/* F Stalls - Row 7 - Exact Figma coordinates */}
            {renderStall('f25', 1415.98, 348.95, 51.18, 37.22, 'F\n25')}
            {renderStall('f26', 1467.16, 348.95, 51.18, 37.22, 'F\n26')}
            {renderStall('f48', 1415.98, 386.18, 51.18, 37.22, 'F\n48')}
            {renderStall('f47', 1467.16, 386.18, 51.18, 37.22, 'F\n47')}

            {/* F Stalls - Row 8 - Exact Figma coordinates */}
            {renderStall('f27', 1555.56, 348.95, 51.18, 37.22, 'F\n27')}
            {renderStall('f28', 1606.74, 348.95, 51.18, 37.22, 'F\n28')}
            {renderStall('f46', 1555.56, 386.18, 51.18, 37.22, 'F\n46')}
            {renderStall('f45', 1606.74, 386.18, 51.18, 37.22, 'F\n45')}

            {/* F Stalls - Row 9 - Exact Figma coordinates */}
            {renderStall('f29', 1695.15, 348.95, 51.18, 37.22, 'F\n29')}
            {renderStall('f30', 1746.33, 348.95, 51.18, 37.22, 'F\n30')}
            {renderStall('f44', 1695.15, 386.18, 51.18, 37.22, 'F\n44')}
            {renderStall('f43', 1746.33, 386.18, 51.18, 37.22, 'F\n43')}

            {/* F Stalls - Row 10 - Exact Figma coordinates */}
            {renderStall('f31', 1834.73, 348.95, 51.18, 37.22, 'F\n31')}
            {renderStall('f32', 1885.91, 348.95, 51.18, 37.22, 'F\n32')}
            {renderStall('f42', 1834.73, 386.18, 51.18, 37.22, 'F\n42')}
            {renderStall('f41', 1885.91, 386.18, 51.18, 37.22, 'F\n41')}

            {/* F Stalls - Row 11 - Exact Figma coordinates */}
            {renderStall('f33', 1974.31, 348.95, 51.18, 37.22, 'F\n33')}
            {renderStall('f34', 2025.49, 348.95, 51.18, 37.22, 'F\n34')}
            {renderStall('f40', 1974.31, 386.18, 51.18, 37.22, 'F\n40')}
            {renderStall('f39', 2025.49, 386.18, 51.18, 37.22, 'F\n39')}

            {/* F Stalls - Row 12 - Exact Figma coordinates */}
            {renderStall('f35', 2116.99, 352.06, 51.18, 37.22, 'F\n35')}
            {renderStall('f36', 2168.17, 352.06, 51.18, 37.22, 'F\n36')}
            {renderStall('f38', 2116.99, 389.28, 51.18, 37.22, 'F\n38')}
            {renderStall('f37', 2168.17, 389.28, 51.18, 37.22, 'F\n37')}

            {/* F Stalls - Row 13 - Exact Figma coordinates */}
            {renderStall('f59', 2116.99, 457.52, 51.18, 37.22, 'F\n59')}
            {renderStall('f60', 2168.17, 457.52, 51.18, 37.22, 'F\n60')}
            {renderStall('f62', 2116.99, 494.74, 51.18, 37.22, 'F\n62')}
            {renderStall('f61', 2168.17, 494.74, 51.18, 37.22, 'F\n61')}

            {/* F Stalls - Row 14 - Exact Figma coordinates */}
            {renderStall('f57', 1974.31, 457.52, 51.18, 37.22, 'F\n57')}
            {renderStall('f58', 2025.49, 457.52, 51.18, 37.22, 'F\n58')}
            {renderStall('f64', 1974.31, 494.74, 51.18, 37.22, 'F\n64')}
            {renderStall('f63', 2025.49, 494.74, 51.18, 37.22, 'F\n63')}

            {/* F Stalls - Row 15 - Exact Figma coordinates */}
            {renderStall('f55', 1834.73, 457.52, 51.18, 37.22, 'F\n55')}
            {renderStall('f56', 1885.91, 457.52, 51.18, 37.22, 'F\n56')}
            {renderStall('f66', 1834.73, 494.74, 51.18, 37.22, 'F\n66')}
            {renderStall('f65', 1885.91, 494.74, 51.18, 37.22, 'F\n65')}

            {/* F Stalls - Row 16 - Exact Figma coordinates */}
            {renderStall('f53', 1695.15, 457.52, 51.18, 37.22, 'F\n53')}
            {renderStall('f54', 1746.33, 457.52, 51.18, 37.22, 'F\n54')}
            {renderStall('f68', 1695.15, 494.74, 51.18, 37.22, 'F\n68')}
            {renderStall('f67', 1746.33, 494.74, 51.18, 37.22, 'F\n67')}

            {/* F Stalls - Row 17 - Exact Figma coordinates */}
            {renderStall('f51', 1555.56, 457.52, 51.18, 37.22, 'F\n51')}
            {renderStall('f52', 1606.74, 457.52, 51.18, 37.22, 'F\n52')}
            {renderStall('f70', 1555.56, 494.74, 51.18, 37.22, 'F\n70')}
            {renderStall('f69', 1606.74, 494.74, 51.18, 37.22, 'F\n69')}

            {/* F Stalls - Row 18 - Exact Figma coordinates */}
            {renderStall('f49', 1415.98, 457.52, 51.18, 37.22, 'F\n49')}
            {renderStall('f50', 1467.16, 457.52, 51.18, 37.22, 'F\n50')}
            {renderStall('f72', 1415.98, 494.74, 51.18, 37.22, 'F\n72')}
            {renderStall('f71', 1467.16, 494.74, 51.18, 37.22, 'F\n71')}

            {/* M Stalls - Center Left Section - Exact Figma coordinates */}
            {renderStall('m19', 637.42, 246.59, 51.18, 37.22, 'M 19')}
            {renderStall('m13', 688.6, 246.59, 51.18, 37.22, 'M 13')}
            {renderStall('m20', 637.42, 283.82, 51.18, 37.22, 'M 20')}
            {renderStall('m14', 688.6, 283.82, 51.18, 37.22, 'M 14')}

            {renderStall('m21', 637.42, 353.61, 51.18, 37.22, 'M 21')}
            {renderStall('m15', 688.6, 353.61, 51.18, 37.22, 'M 15')}
            {renderStall('m22', 637.42, 390.83, 51.18, 37.22, 'M 22')}
            {renderStall('m16', 688.6, 390.83, 51.18, 37.22, 'M 16')}

            {renderStall('m23', 637.42, 460.62, 51.18, 37.22, 'M 23')}
            {renderStall('m17', 688.6, 460.62, 51.18, 37.22, 'M 17')}
            {renderStall('m24', 637.42, 497.84, 51.18, 37.22, 'M 24')}
            {renderStall('m18', 688.6, 497.84, 51.18, 37.22, 'M 18')}

            {/* M Stalls - Center Section - Exact Figma coordinates */}
            {renderStall('m31', 497.84, 246.59, 51.18, 37.22, 'M 31')}
            {renderStall('m25', 549.02, 246.59, 51.18, 37.22, 'M 25')}
            {renderStall('m32', 497.84, 283.82, 51.18, 37.22, 'M 32')}
            {renderStall('m26', 549.02, 283.82, 51.18, 37.22, 'M 26')}

            {renderStall('m33', 497.84, 353.61, 51.18, 37.22, 'M 33')}
            {renderStall('m27', 549.02, 353.61, 51.18, 37.22, 'M 27')}
            {renderStall('m34', 497.84, 390.83, 51.18, 37.22, 'M 34')}
            {renderStall('m28', 549.02, 390.83, 51.18, 37.22, 'M 28')}

            {renderStall('m35', 497.84, 460.62, 51.18, 37.22, 'M 35')}
            {renderStall('m29', 549.02, 460.62, 51.18, 37.22, 'M 29')}
            {renderStall('m36', 497.84, 497.84, 51.18, 37.22, 'M 36')}
            {renderStall('m30', 549.02, 497.84, 51.18, 37.22, 'M 30')}

            {/* M Stalls - Center Right Section - Exact Figma coordinates */}
            {renderStall('m43', 358.26, 246.59, 51.18, 37.22, 'M 43')}
            {renderStall('m37', 409.44, 246.59, 51.18, 37.22, 'M 37')}
            {renderStall('m44', 358.26, 283.82, 51.18, 37.22, 'M 44')}
            {renderStall('m38', 409.44, 283.82, 51.18, 37.22, 'M 38')}

            {renderStall('m45', 358.26, 353.61, 51.18, 37.22, 'M 45')}
            {renderStall('m39', 409.44, 353.61, 51.18, 37.22, 'M 39')}
            {renderStall('m46', 358.26, 390.83, 51.18, 37.22, 'M 46')}
            {renderStall('m40', 409.44, 390.83, 51.18, 37.22, 'M 40')}

            {renderStall('m47', 358.26, 460.62, 51.18, 37.22, 'M 47')}
            {renderStall('m41', 409.44, 460.62, 51.18, 37.22, 'M 41')}
            {renderStall('m48', 358.26, 497.84, 51.18, 37.22, 'M 48')}
            {renderStall('m42', 409.44, 497.84, 51.18, 37.22, 'M 42')}

            {/* M Stalls - Center Left Section - Exact Figma coordinates */}
            {renderStall('m55', 217.13, 246.59, 51.18, 37.22, 'M 55')}
            {renderStall('m49', 268.31, 246.59, 51.18, 37.22, 'M 49')}
            {renderStall('m56', 217.13, 283.82, 51.18, 37.22, 'M 56')}
            {renderStall('m50', 268.31, 283.82, 51.18, 37.22, 'M 50')}

            {renderStall('m57', 217.13, 353.61, 51.18, 37.22, 'M 57')}
            {renderStall('m51', 268.31, 353.61, 51.18, 37.22, 'M 51')}
            {renderStall('m58', 217.13, 390.83, 51.18, 37.22, 'M 58')}
            {renderStall('m52', 268.31, 390.83, 51.18, 37.22, 'M 52')}

            {renderStall('m59', 217.13, 460.62, 51.18, 37.22, 'M 59')}
            {renderStall('m53', 268.31, 460.62, 51.18, 37.22, 'M 53')}
            {renderStall('m60', 217.13, 497.84, 51.18, 37.22, 'M 60')}
            {renderStall('m54', 268.31, 497.84, 51.18, 37.22, 'M 54')}

            {/* M Stalls - Left Section - Exact Figma coordinates */}
            {renderStall('m69', 77.54, 353.61, 51.18, 37.22, 'M 69')}
            {renderStall('m63', 128.73, 353.61, 51.18, 37.22, 'M 63')}
            {renderStall('m70', 77.55, 390.83, 51.18, 37.22, 'M 70')}
            {renderStall('m64', 128.73, 390.83, 51.18, 37.22, 'M 64')}

            {renderStall('m71', 77.54, 460.62, 51.18, 37.22, 'M 71')}
            {renderStall('m65', 128.73, 460.62, 51.18, 37.22, 'M 65')}
            {renderStall('m72', 77.55, 497.84, 51.18, 37.22, 'M 72')}
            {renderStall('m66', 128.73, 497.84, 51.18, 37.22, 'M 66')}

            {/* RG Stalls (Retail General) - Exact Figma coordinates */}
            {renderStall('rg1', 1415.98, 575.39, 51.18, 69.79, 'RG\n1')}
            {renderStall('rg2', 1467.16, 575.39, 51.18, 69.79, 'RG\n2')}
            {renderStall('rg4', 1415.98, 645.18, 51.18, 69.79, 'RG\n4')}
            {renderStall('rg3', 1467.16, 645.18, 51.18, 69.79, 'RG\n3')}

            {renderStall('rg5', 1560.22, 575.39, 51.18, 69.79, 'RG\n5')}
            {renderStall('rg6', 1611.4, 575.39, 51.18, 69.79, 'RG\n6')}
            {renderStall('rg7', 1560.22, 645.18, 51.18, 69.79, 'RG\n7')}
            {renderStall('rg8', 1611.4, 645.18, 51.18, 69.79, 'RG\n8')}

            {renderStall('rg9', 1695.15, 575.39, 51.18, 69.79, 'RG\n9')}
            {renderStall('rg10', 1746.33, 575.39, 51.18, 69.79, 'RG\n10')}
            {renderStall('rg11', 1695.15, 645.18, 51.18, 69.79, 'RG\n11')}
            {renderStall('rg12', 1746.33, 645.18, 51.18, 69.79, 'RG\n12')}

            {/* RG Stalls - Aligned with F stalls for perfect vertical alignment - Exact Figma coordinates */}
            {renderStall('rg16', 1834.73, 575.39, 51.18, 69.79, 'RG\n16')}
            {renderStall('rg15', 1885.91, 575.39, 51.18, 69.79, 'RG\n15')}
            {renderStall('rg13', 1834.73, 645.18, 51.18, 69.79, 'RG\n13')}
            {renderStall('rg14', 1885.91, 645.18, 51.18, 69.79, 'RG\n14')}

            {renderStall('rg18', 1974.31, 575.39, 51.18, 69.79, 'RG\n18')}
            {renderStall('rg17', 2025.49, 575.39, 51.18, 69.79, 'RG\n17')}
            {renderStall('rg19', 1974.31, 645.18, 51.18, 69.79, 'RG\n19')}
            {renderStall('rg20', 2025.49, 645.18, 51.18, 69.79, 'RG\n20')}

            {/* DF Stalls (Dry Food) - Exact Figma coordinates */}
            {renderStall('df6', 2113.89, 575.39, 51.18, 69.79, 'DF\n6')}
            {renderStall('df12', 2165.07, 575.39, 51.18, 69.79, 'DF\n12')}
            {renderStall('df5', 2113.89, 645.18, 51.18, 69.79, 'DF\n5')}
            {renderStall('df11', 2165.07, 645.18, 51.18, 69.79, 'DF\n11')}

            {/* E Stalls (Entrance) - Exact Figma coordinates */}
            {renderStall('e11', 694.81, 66.69, 97.71, 58.93, 'E\n11')}
            {renderStall('e12', 694.81, 142.68, 97.71, 58.93, 'E\n12')}
            {renderStall('e10', 828.19, 66.69, 97.71, 58.93, 'E 10')}
            {renderStall('e9', 828.19, 142.68, 97.71, 58.93, 'E 9')}
            {renderStall('e7', 961.56, 68.24, 97.71, 58.93, 'E 7')}
            {renderStall('e8', 961.56, 144.23, 97.71, 58.93, 'E 8')}
            {renderStall('e6', 1091.84, 66.69, 97.71, 58.93, 'E 6')}
            {renderStall('e5', 1091.84, 142.68, 97.71, 58.93, 'E 5')}
            {renderStall('e3', 1284.15, 66.69, 97.71, 58.93, 'E 3')}
            {renderStall('e4', 1284.15, 144.23, 97.71, 58.93, 'E 4')}
            {renderStall('e2', 1415.98, 66.69, 97.71, 58.93, 'E 2')}
            {renderStall('e1', 1415.98, 144.23, 97.71, 58.93, 'E 1')}

            {/* V Stalls (Vendor) - Exact Figma coordinates */}
            {renderStall('v5', 1547.81, 66.69, 74.44, 68.24, 'V\n5')}
            {renderStall('v4', 1622.25, 66.69, 74.44, 68.24, 'V\n4')}
            {renderStall('v3', 1696.7, 66.69, 74.44, 68.24, 'V\n3')}
            {renderStall('v2', 1771.14, 66.69, 74.44, 68.24, 'V\n2')}
            {renderStall('v1', 1845.58, 66.69, 74.44, 68.24, 'V\n1')}

            {/* V Stalls - Center Section - Exact Figma coordinates */}
            {renderStall('v7', 496.29, 68.24, 51.18, 69.79, 'V\n7')}
            {renderStall('v9', 496.29, 138.03, 51.18, 69.79, 'V\n9')}
            {renderStall('v6', 547.47, 68.24, 51.18, 69.79, 'V\n6')}
            {renderStall('v8', 547.47, 138.03, 51.18, 69.79, 'V\n8')}

            {renderStall('v11', 358.26, 68.24, 51.18, 69.79, 'V\n11')}
            {renderStall('v10', 409.44, 68.24, 51.18, 69.79, 'V\n10')}
            {renderStall('v13', 358.26, 138.03, 51.18, 69.79, 'V\n13')}
            {renderStall('v14', 409.44, 138.03, 51.18, 69.79, 'V\n14')}

            {/* G Stalls (General) - Exact Figma coordinates */}
            {renderStall('g1', 77.54, 575.39, 51.18, 69.79, 'G1')}
            {renderStall('g2', 128.73, 575.39, 51.18, 69.79, 'G2')}
            {renderStall('g4', 77.55, 645.18, 51.18, 69.79, 'G4')}
            {renderStall('g3', 128.73, 645.18, 51.18, 69.79, 'G3')}

            {renderStall('g7', 214.03, 575.39, 51.18, 69.79, 'G7')}
            {renderStall('g8', 265.21, 575.39, 51.18, 69.79, 'G8')}
            {renderStall('g5', 214.03, 645.18, 51.18, 69.79, 'G5')}
            {renderStall('g6', 265.21, 645.18, 51.18, 69.79, 'G6')}

            {renderStall('g9', 350.51, 573.84, 51.18, 69.79, 'G9')}
            {renderStall('g10', 401.69, 573.84, 51.18, 69.79, 'G10')}
            {renderStall('g11', 350.51, 643.63, 51.18, 69.79, 'G11')}
            {renderStall('g12', 401.69, 643.63, 51.18, 69.79, 'G12')}

            {/* FV Stalls (Fresh Vegetables) - Exact Figma coordinates */}
            {renderStall('fv1', 496.29, 575.39, 51.18, 69.79, 'FV1', 'vegetable', true, 'Green Garden', ['Tomatoes', 'Lettuce', 'Carrots'])}
            {renderStall('fv2', 547.47, 575.39, 51.18, 69.79, 'FV2', 'vegetable', true, 'Farm Fresh', ['Onions', 'Potatoes', 'Bell Peppers'])}
            {renderStall('fv4', 496.29, 645.18, 51.18, 69.79, 'FV4', 'vegetable', false)}
            {renderStall('fv3', 547.47, 645.18, 51.18, 69.79, 'FV3', 'vegetable', true, 'Organic Corner', ['Spinach', 'Broccoli', 'Cucumber'])}

            {renderStall('fv8', 635.87, 573.84, 51.18, 69.79, 'FV8')}
            {renderStall('fv7', 687.05, 573.84, 51.18, 69.79, 'FV7')}
            {renderStall('fv5', 635.87, 643.63, 51.18, 69.79, 'FV5')}
            {renderStall('fv6', 687.05, 643.63, 51.18, 69.79, 'FV6')}

            {renderStall('fv9', 775.46, 573.84, 51.18, 69.79, 'FV9')}
            {renderStall('fv10', 826.64, 573.84, 51.18, 69.79, 'FV10')}
            {renderStall('fv12', 775.46, 643.63, 51.18, 69.79, 'FV12')}
            {renderStall('fv11', 826.64, 643.63, 51.18, 69.79, 'FV11')}

            {renderStall('fv14', 936.75, 573.84, 51.18, 69.79, 'FV14')}
            {renderStall('fv13', 987.93, 573.84, 51.18, 69.79, 'FV13')}
            {renderStall('fv15', 936.75, 643.63, 51.18, 69.79, 'FV15')}
            {renderStall('fv16', 987.93, 643.63, 51.18, 69.79, 'FV16')}

            {renderStall('fv20', 1091.84, 573.84, 51.18, 69.79, 'FV20')}
            {renderStall('fv18', 1143.02, 573.84, 51.18, 69.79, 'FV18')}
            {renderStall('fv17', 1091.84, 643.63, 51.18, 69.79, 'FV17')}
            {renderStall('fv19', 1143.02, 643.63, 51.18, 69.79, 'FV19')}

            {/* FV Stalls - Additional Rows - Exact Figma coordinates */}
            {renderStall('fv27-1', 1091.84, 400.13, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-2', 1143.02, 400.13, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-3', 1091.84, 469.93, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-4', 1143.02, 469.93, 51.18, 69.79, 'FV27')}

            {renderStall('fv27-5', 936.75, 237.29, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-6', 987.93, 237.29, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-7', 936.75, 307.08, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-8', 987.93, 307.08, 51.18, 69.79, 'FV27')}

            {renderStall('fv27-9', 1091.84, 237.29, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-10', 1143.02, 237.29, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-11', 1091.84, 307.08, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-12', 1143.02, 307.08, 51.18, 69.79, 'FV27')}

            {renderStall('fv27-13', 936.75, 400.13, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-14', 987.93, 400.13, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-15', 936.75, 469.93, 51.18, 69.79, 'FV27')}
            {renderStall('fv27-16', 987.93, 469.93, 51.18, 69.79, 'FV27')}

            {/* Special Areas - Exact Figma coordinates */}
            {renderArea('ice-storage', 1547.81, 134.93, 372.22, 68.24, 'ICE STORAGE')}
            {/* COMFORT ROOM - Exact Figma coordinates */}
            {renderArea('comfort-room', 1986.71, 66.69, 181.46, 136.48, 'COMFORT ROOM')}

            {/* FISH STORAGE - L-Shape - Top edge aligned with map frame, bottom with comfort room, left edge aligned with F11, right edge aligned with F12 */}
            {/* Vertical part of L */}
            {renderArea('fish-storage-vertical', 2116.99, 0, 102.36, 66.69, 'FISH\nSTORAGE')}
            {/* Horizontal part of L - positioned below fish storage, extended to comfort room bottom */}
            {renderArea('fish-storage-horizontal', 2168.17, 66.69, 51.18, 136.48, '')}

          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mapContainer: {
    flex: 1,
    marginTop: 20,
  },

  zoomIndicatorContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1000,
    alignItems: 'flex-end',
  },

  zoomInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 8,
  },

  zoomText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  panIndicator: {
    backgroundColor: 'rgba(66, 165, 245, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  panText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },

  zoomIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

});

export default IndoorMarketMap;
