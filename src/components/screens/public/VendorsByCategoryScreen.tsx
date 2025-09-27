import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorsByCategory'>;

interface VendorInfo {
    id: string;
    business_name: string;
    contact_number?: string; // We'll map phone_number to this for consistency
    stall?: {
        stall_number: string;
        location_description?: string;
    };
    productCount: number;
    availableProductCount: number;
}

const VendorsByCategoryScreen: React.FC<Props> = ({ route, navigation }) => {
    const { category } = route.params;
    const [vendors, setVendors] = useState<VendorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchVendorsByCategory();
    }, [category]);

    const fetchVendorsByCategory = async () => {
        try {
            setLoading(true);
            setError(null);

            // Query vendor_products based on vendor business type since products don't have category column
            const { data: vendorProducts, error: vendorError } = await supabase
                .from('vendor_products')
                .select(`
          vendor_id,
          status,
          vendor_profiles!inner (
            id,
            business_name,
            phone_number,
            stall_number,
            complete_address
          ),
          products!inner (
            id,
            name,
            description
          )
        `);

            if (vendorError) {
                console.error('Error fetching vendors:', vendorError);
                setError('Failed to load vendors');
                return;
            }

            console.log('Vendor products data:', vendorProducts);

            // Filter and group by vendor based on business type and calculate product counts
            const vendorMap = new Map<string, any>();

            vendorProducts?.forEach((item: any) => {
                const vendorId = item.vendor_id;
                const businessName = item.vendor_profiles.business_name.toLowerCase();
                const isAvailable = item.status === 'available' || item.status === 'active';

                // Filter vendors based on category - match business name with category
                let matchesCategory = false;
                if (category.toLowerCase() === 'fish') {
                    matchesCategory = businessName.includes('fish');
                } else if (category.toLowerCase() === 'pork') {
                    matchesCategory = businessName.includes('pork') || businessName.includes('meat');
                } else if (category.toLowerCase() === 'vegetables') {
                    matchesCategory = businessName.includes('vegetable') || businessName.includes('veggie');
                } else if (category.toLowerCase() === 'rice/grain') {
                    matchesCategory = businessName.includes('rice') || businessName.includes('grain');
                }

                if (!matchesCategory) return; // Skip vendors that don't match the category

                if (!vendorMap.has(vendorId)) {
                    vendorMap.set(vendorId, {
                        id: vendorId,
                        business_name: item.vendor_profiles.business_name,
                        contact_number: item.vendor_profiles.phone_number,
                        productCount: 0,
                        availableProductCount: 0,
                        stall: null,
                    });
                }

                const vendor = vendorMap.get(vendorId);
                vendor.productCount += 1;
                if (isAvailable) {
                    vendor.availableProductCount += 1;
                }
            });

            // Fetch stall information for each vendor
            const vendorIds = Array.from(vendorMap.keys());
            const { data: stalls, error: stallError } = await supabase
                .from('stalls')
                .select('vendor_profile_id, stall_number, location_description')
                .in('vendor_profile_id', vendorIds);

            if (stallError) {
                console.warn('Error fetching stall data:', stallError);
            }

            // Add stall information to vendors from stalls table
            stalls?.forEach((stall: any) => {
                const vendor = vendorMap.get(stall.vendor_profile_id);
                if (vendor) {
                    vendor.stall = {
                        stall_number: stall.stall_number,
                        location_description: stall.location_description,
                    };
                }
            });

            // For vendors without stall data, use fallback from vendor_profiles or defaults
            Array.from(vendorMap.values()).forEach((vendor: any) => {
                if (!vendor.stall) {
                    // Find the vendor profile data from the original query
                    const vendorProductItem = vendorProducts?.find(item => item.vendor_id === vendor.id);
                    if (vendorProductItem?.vendor_profiles) {
                        const vendorProfile = vendorProductItem.vendor_profiles as any;
                        vendor.stall = {
                            stall_number: vendorProfile.stall_number || 'F-1', // Default for Fish vendors
                            location_description: vendorProfile.complete_address || 'Toril Public Market'
                        };
                    } else {
                        // Complete fallback for vendors with no profile data
                        vendor.stall = {
                            stall_number: 'F-1',
                            location_description: 'Toril Public Market'
                        };
                    }
                }
            });

            // Convert map to array and filter vendors with available products
            const vendorList = Array.from(vendorMap.values()).filter(
                (vendor: any) => vendor.availableProductCount > 0
            );

            setVendors(vendorList);
        } catch (err) {
            console.error('Unexpected error:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleVendorPress = (vendor: VendorInfo) => {
        navigation.navigate('VendorDetails', {
            vendorId: vendor.id,
            vendorName: vendor.business_name
        });
    };

    const renderVendorCard = ({ item }: { item: VendorInfo }) => {
        // Determine status color based on available products
        const getStatusColor = () => {
            if (item.availableProductCount > 0) return '#4CAF50'; // Green for available
            return '#F44336'; // Red for unavailable
        };

        const getStatusText = () => {
            return item.availableProductCount > 0 ? 'Open' : 'Closed';
        };

        return (
            <TouchableOpacity style={styles.stallCard} onPress={() => handleVendorPress(item)}>
                <View style={styles.stallHeader}>
                    <View style={styles.stallTitleSection}>
                        <Text style={styles.stallName}>{item.business_name}</Text>
                        <View style={styles.stallLocationRow}>
                            <Text style={styles.stallNumber}>
                                {item.stall?.stall_number ? `Stall ${item.stall.stall_number}` : 'No Stall'}
                            </Text>
                            {item.stall?.location_description && (
                                <Text style={styles.stallLocation}> • {item.stall.location_description}</Text>
                            )}
                        </View>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                </View>

                <Text style={styles.stallProductCount}>
                    � {item.availableProductCount} products available
                </Text>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading {category.toLowerCase()} vendors...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchVendorsByCategory}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{category} Vendors</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.contentContainer}>
                <Text style={styles.sectionTitle}>List of Stalls</Text>

                {vendors.length === 0 ? (
                    <View style={styles.centered}>
                        <Text style={styles.noVendorsText}>
                            No vendors selling {category.toLowerCase()} products found.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={vendors}
                        keyExtractor={(item) => item.id}
                        renderItem={renderVendorCard}
                        contentContainerStyle={styles.listContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#4CAF50',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        backgroundColor: '#4CAF50',
    },
    backButton: {
        padding: 5,
    },
    backButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    placeholder: {
        width: 60,
    },
    contentContainer: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666666',
        marginLeft: 20,
        marginBottom: 15,
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    stallCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    stallHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    stallTitleSection: {
        flex: 1,
    },
    stallName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
    },
    stallLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stallNumber: {
        fontSize: 14,
        color: '#666666',
        fontWeight: '500',
    },
    stallLocation: {
        fontSize: 14,
        color: '#666666',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginLeft: 10,
    },
    stallProductCount: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '500',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666666',
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 16,
    },
    noVendorsText: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default VendorsByCategoryScreen;