import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Stall {
    id: string;
    name: string;
    category: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
}

interface SpecialArea {
    id: string;
    name: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    color: string;
}

interface Exit {
    id: string;
    name: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
}

interface IndoorMarketMapProps {
    selectedCategory?: string | null;
    onStallPress?: (stallId: string) => void;
}

const categoryColors: { [key: string]: string } = {
    'Fish': '#4A90E2',
    'Meat': '#E24A4A',
    'Vegetables': '#4AE24A',
    'Fruits': '#E2E24A',
    'Poultry': '#E24AE2',
    'Dairy': '#4AE2E2',
    'Bakery': '#E2A54A',
    'General': '#A5A5A5',
};

// Sample stall data - you can replace this with data from your Supabase
const stalls: Stall[] = [
    { id: '1', name: 'Fish Stall 1', category: 'Fish', position: { x: 100, y: 200 }, size: { width: 80, height: 60 } },
    { id: '2', name: 'Meat Stall 1', category: 'Meat', position: { x: 200, y: 200 }, size: { width: 80, height: 60 } },
    { id: '3', name: 'Veg Stall 1', category: 'Vegetables', position: { x: 300, y: 200 }, size: { width: 80, height: 60 } },
    { id: '4', name: 'Fruit Stall 1', category: 'Fruits', position: { x: 400, y: 200 }, size: { width: 80, height: 60 } },
    { id: '5', name: 'Fish Stall 2', category: 'Fish', position: { x: 100, y: 300 }, size: { width: 80, height: 60 } },
    { id: '6', name: 'Meat Stall 2', category: 'Meat', position: { x: 200, y: 300 }, size: { width: 80, height: 60 } },
    { id: '7', name: 'Veg Stall 2', category: 'Vegetables', position: { x: 300, y: 300 }, size: { width: 80, height: 60 } },
    { id: '8', name: 'Fruit Stall 2', category: 'Fruits', position: { x: 400, y: 300 }, size: { width: 80, height: 60 } },
];

const specialAreas: SpecialArea[] = [
    { id: 'entrance', name: 'Main Entrance', position: { x: 50, y: 50 }, size: { width: 100, height: 40 }, color: '#FFD700' },
    { id: 'exit', name: 'Exit', position: { x: 450, y: 50 }, size: { width: 100, height: 40 }, color: '#FF6B6B' },
];

const exits: Exit[] = [
    { id: 'exit1', name: 'Exit 1', position: { x: 0, y: 100 }, size: { width: 20, height: 80 } },
    { id: 'exit2', name: 'Exit 2', position: { x: 580, y: 100 }, size: { width: 20, height: 80 } },
];

const IndoorMarketMap: React.FC<IndoorMarketMapProps> = ({ selectedCategory, onStallPress }) => {
    const svgWidth = 600;
    const svgHeight = 400;
    const containerWidth = screenWidth;
    const containerHeight = screenHeight * 0.7; // Use 70% of screen height

    const filteredStalls = selectedCategory
        ? stalls.filter(stall => stall.category === selectedCategory)
        : stalls;

    const handleStallPress = (stallId: string) => {
        if (onStallPress) {
            onStallPress(stallId);
        }
    };

    const renderStall = (stall: Stall) => {
        const isSelected = selectedCategory ? stall.category === selectedCategory : true;

        return (
            <TouchableOpacity
                key={stall.id}
                style={{
                    position: 'absolute',
                    left: (stall.position.x / svgWidth) * containerWidth,
                    top: (stall.position.y / svgHeight) * containerHeight,
                    width: (stall.size.width / svgWidth) * containerWidth,
                    height: (stall.size.height / svgHeight) * containerHeight,
                    backgroundColor: categoryColors[stall.category] || '#A5A5A5',
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: isSelected ? 1 : 0.3,
                    borderWidth: 1,
                    borderColor: '#000000',
                    borderRadius: 4,
                }}
                onPress={() => handleStallPress(stall.id)}
            >
                <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>
                    {stall.name}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderSpecialArea = (area: SpecialArea) => (
        <View
            key={area.id}
            style={{
                position: 'absolute',
                left: (area.position.x / svgWidth) * containerWidth,
                top: (area.position.y / svgHeight) * containerHeight,
                width: (area.size.width / svgWidth) * containerWidth,
                height: (area.size.height / svgHeight) * containerHeight,
                backgroundColor: area.color,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: '#000000',
                borderRadius: 4,
            }}
        >
            <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                {area.name}
            </Text>
        </View>
    );

    const renderExit = (exit: Exit) => (
        <View
            key={exit.id}
            style={{
                position: 'absolute',
                left: (exit.position.x / svgWidth) * containerWidth,
                top: (exit.position.y / svgHeight) * containerHeight,
                width: (exit.size.width / svgWidth) * containerWidth,
                height: (exit.size.height / svgHeight) * containerHeight,
                backgroundColor: '#8B4513',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#000000',
            }}
        >
            <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold', textAlign: 'center' }}>
                {exit.name}
            </Text>
        </View>
    );

    const renderSeparatorLines = () => {
        const lines = [];

        // Vertical lines
        for (let i = 1; i < 6; i++) {
            const x = (i * svgWidth / 6);
            lines.push(
                <View
                    key={`vline-${i}`}
                    style={{
                        position: 'absolute',
                        left: (x / svgWidth) * containerWidth,
                        top: 0,
                        width: 2,
                        height: containerHeight,
                        backgroundColor: '#000000',
                    }}
                />
            );
        }

        // Horizontal lines
        for (let i = 1; i < 4; i++) {
            const y = (i * svgHeight / 4);
            lines.push(
                <View
                    key={`hline-${i}`}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: (y / svgHeight) * containerHeight,
                        width: containerWidth,
                        height: 2,
                        backgroundColor: '#000000',
                    }}
                />
            );
        }

        return lines;
    };

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ width: containerWidth }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ height: containerHeight + 200 }}
                    style={{ flex: 1 }}
                >
                    <View style={{
                        width: containerWidth,
                        height: containerHeight,
                        position: 'relative',
                        borderWidth: 3,
                        borderColor: '#000000',
                        borderRadius: 5,
                        backgroundColor: '#DEDEDE'
                    }}>
                        {/* Black separator lines */}
                        {renderSeparatorLines()}

                        {/* Stalls */}
                        {filteredStalls.map(renderStall)}

                        {/* Special Areas */}
                        {specialAreas.map(renderSpecialArea)}

                        {/* Exits */}
                        {exits.map(renderExit)}
                    </View>
                </ScrollView>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#DEDEDE',
    },
});

export default IndoorMarketMap;



