import React, { useEffect, useMemo, useState } from 'react';
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
    meatTypes?: { pork: boolean; beef: boolean; chicken: boolean };
}

const VendorsByCategoryScreen: React.FC<Props> = ({ route, navigation }) => {
    const { category } = route.params;
    const [vendors, setVendors] = useState<VendorInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortMode, setSortMode] = useState<'alpha' | 'stall'>('alpha'); // toggle between alphabetical and stall number

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
                        description,
                        category_id,
                        product_categories ( name )
          )
        `);

            if (vendorError) {
                console.error('Error fetching vendors:', vendorError);
                setError('Failed to load vendors');
                return;
            }

            console.log('Vendor products data:', vendorProducts);

            // Filter and group by vendor based on selected category and calculate product counts
            const vendorMap = new Map<string, any>();

            const normalize = (s: string) => (s || '').toLowerCase();
            const selected = normalize(category);

            vendorProducts?.forEach((item: any) => {
                const vendorId = item.vendor_id;
                const businessName = normalize(item.vendor_profiles.business_name);
                const productName = normalize(item.products?.name || '');
                const productCategoryName = normalize(item.products?.product_categories?.[0]?.name || item.products?.product_categories?.name || '');
                const isAvailable = item.status === 'available' || item.status === 'active';
                const stallRaw = (item.vendor_profiles?.stall_number || '').toString();
                const stallUpper = stallRaw.toUpperCase().replace(/\s+/g, '');

                // Determine meat subtype flags for badges
                const isPork = (
                    productCategoryName.includes('pork') ||
                    productName.includes('pork') || productName.includes('baboy') || productName.includes('liempo') || productName.includes('lomo') || productName.includes('pigue') || productName.includes('pata') || productName.includes('tadyang') || productName.includes('loin') || productName.includes('chop') || productName.includes('shoulder')
                );
                const isBeef = (
                    productCategoryName.includes('beef') ||
                    productName.includes('beef') || productName.includes('baka') || productName.includes('brisket') || productName.includes('sirloin') || productName.includes('tenderloin') || productName.includes('ribeye') || productName.includes('ribs') || productName.includes('short rib') || productName.includes('shank') || productName.includes('oxtail') || productName.includes('kalitiran') || productName.includes('tadyang')
                );
                const isChicken = (
                    productCategoryName.includes('chicken') ||
                    productName.includes('chicken') || productName.includes('manok') || productName.includes('drumstick') || productName.includes('thigh') || productName.includes('wing') || productName.includes('breast')
                );

                // Filter vendors based on main categories
                let matchesCategory = false;
                if (selected === 'fish') {
                    // Strictly F stalls (not DF)
                    const stallOk = stallUpper.startsWith('F') && !stallUpper.startsWith('DF');
                    matchesCategory = stallOk;
                } else if (selected === 'meat') {
                    // Any vendor selling pork/beef/chicken (by product category or item names) counts as Meat
                    matchesCategory = (
                        productCategoryName.includes('meat') || productCategoryName.includes('pork') || productCategoryName.includes('beef') || productCategoryName.includes('chicken') ||
                        businessName.includes('meat') || businessName.includes('butcher') || businessName.includes('karne') ||
                        productName.includes('pork') || productName.includes('baboy') || productName.includes('liempo') || productName.includes('lomo') || productName.includes('pigue') || productName.includes('pata') || productName.includes('tadyang') ||
                        productName.includes('beef') || productName.includes('baka') || productName.includes('brisket') || productName.includes('sirloin') || productName.includes('tenderloin') || productName.includes('ribeye') || productName.includes('ribs') || productName.includes('short rib') || productName.includes('shank') || productName.includes('oxtail') || productName.includes('kalitiran') ||
                        productName.includes('chicken') || productName.includes('manok') || productName.includes('drumstick') || productName.includes('thigh') || productName.includes('wing') || productName.includes('breast') ||
                        productName.includes('goat') || productName.includes('kambing') || productName.includes('carabeef') || productName.includes('veal')
                    );
                } else if (selected === 'pork') {
                    matchesCategory = (
                        productCategoryName.includes('pork') ||
                        businessName.includes('pork') || businessName.includes('karne') ||
                        productName.includes('pork') || productName.includes('baboy') || productName.includes('pigue') || productName.includes('pata') || productName.includes('liempo') || productName.includes('lomo') || productName.includes('tadyang')
                    );
                } else if (selected === 'beef') {
                    matchesCategory = (
                        productCategoryName.includes('beef') ||
                        businessName.includes('beef') || businessName.includes('karne') ||
                        productName.includes('beef') || productName.includes('baka') || productName.includes('brisket') || productName.includes('sirloin') || productName.includes('tenderloin') || productName.includes('ribeye') || productName.includes('ribs') || productName.includes('short rib') || productName.includes('shank') || productName.includes('oxtail') || productName.includes('kalitiran') || productName.includes('tadyang')
                    );
                } else if (selected === 'chicken') {
                    matchesCategory = (
                        productCategoryName.includes('chicken') ||
                        businessName.includes('chicken') || businessName.includes('manok') || businessName.includes('karne') ||
                        productName.includes('chicken') || productName.includes('manok') || productName.includes('drumstick') || productName.includes('thigh') || productName.includes('wing') || productName.includes('breast')
                    );
                } else if (selected === 'vegetables & fruits') {
                    matchesCategory = (
                        businessName.includes('vegetable') || businessName.includes('veggie') || businessName.includes('gulay') ||
                        businessName.includes('fruit') || businessName.includes('prutas') ||
                        productName.includes('vegetable') || productName.includes('gulay') ||
                        productName.includes('fruit') || productName.includes('prutas')
                    );
                } else if (selected === 'rice & grain' || selected === 'rice/grain') {
                    matchesCategory = (
                        businessName.includes('rice') || businessName.includes('grain') || businessName.includes('bigas') || businessName.includes('palay') ||
                        productName.includes('rice') || productName.includes('grain') || productName.includes('bigas') || productName.includes('palay')
                    );
                } else if (selected === 'grocery') {
                    matchesCategory = (
                        businessName.includes('grocery') || businessName.includes('sari-sari') || businessName.includes('store') ||
                        productName.includes('sardines') || productName.includes('canned') || productName.includes('noodles') ||
                        productName.includes('suka') || productName.includes('toyo') || productName.includes('patis') ||
                        productName.includes('sugar') || productName.includes('salt') || productName.includes('oil')
                    );
                } else if (selected === 'dried fish') {
                    // Strictly DF stalls
                    const stallOk = stallUpper.startsWith('DF');
                    matchesCategory = stallOk;
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
                        meatTypes: { pork: false, beef: false, chicken: false },
                    });
                }

                const vendor = vendorMap.get(vendorId);
                vendor.productCount += 1;
                if (isAvailable) {
                    vendor.availableProductCount += 1;
                }
                // Accumulate meat type flags
                if (isPork) vendor.meatTypes.pork = true;
                if (isBeef) vendor.meatTypes.beef = true;
                if (isChicken) vendor.meatTypes.chicken = true;
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

            // For vendors without stall data, try to use data from vendor_profiles; avoid hardcoded defaults
            Array.from(vendorMap.values()).forEach((vendor: any) => {
                if (!vendor.stall) {
                    // Find the vendor profile data from the original query
                    const vendorProductItem = vendorProducts?.find(item => item.vendor_id === vendor.id);
                    if (vendorProductItem?.vendor_profiles) {
                        const vendorProfile = vendorProductItem.vendor_profiles as any;
                        if (vendorProfile.stall_number || vendorProfile.complete_address) {
                            vendor.stall = {
                                stall_number: vendorProfile.stall_number || undefined,
                                location_description: vendorProfile.complete_address || 'Toril Public Market'
                            };
                        }
                    } else {
                        // No extra data available; keep stall as null
                    }
                }
            });

            // Convert map to array (we'll sort in UI based on selected mode)
            const vendorList = Array.from(vendorMap.values());

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

    // Derived sorted vendors by selected numeric mode
    const sortedVendors = useMemo(() => {
        const list = [...vendors];
        const normalizeName = (s?: string) => (s || '').toString().toLowerCase();
        const stallKey = (stallNo?: string) => {
            const s = (stallNo || '').toString();
            const numMatch = s.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0], 10) : Number.MAX_SAFE_INTEGER;
            const prefix = (s.match(/[A-Za-z]+/) || ['zzz'])[0];
            return { prefix, num };
        };

        if (sortMode === 'alpha') {
            return list.sort((a, b) => normalizeName(a.business_name).localeCompare(normalizeName(b.business_name)));
        }
        // 'stall' numerical order
        return list.sort((a: any, b: any) => {
            const ka = stallKey(a.stall?.stall_number);
            const kb = stallKey(b.stall?.stall_number);
            if (ka.prefix !== kb.prefix) return ka.prefix.localeCompare(kb.prefix);
            return ka.num - kb.num;
        });
    }, [vendors, sortMode]);

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
                    <View style={styles.badgesRight}>
                        {(() => {
                            const icons: string[] = [];
                            if (item.meatTypes?.pork) icons.push('🐖');
                            if (item.meatTypes?.beef) icons.push('🐄');
                            if (item.meatTypes?.chicken) icons.push('🍗');
                            return icons.map((ic, idx) => (
                                <Text key={idx} style={styles.badgeIcon}>{ic}</Text>
                            ));
                        })()}
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                    </View>
                </View>

                <Text style={styles.stallProductCount}>
                    • {item.availableProductCount} products available
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

                {/* Sort Toggle: Alphabetical vs Stall # */}
                <View style={styles.sortBar}>
                    <TouchableOpacity
                        style={styles.sortToggle}
                        onPress={() => setSortMode(prev => (prev === 'alpha' ? 'stall' : 'alpha'))}
                    >
                        <Text style={styles.sortToggleText}>
                            Sort: {sortMode === 'alpha' ? 'A–Z' : 'Stall #'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {sortedVendors.length === 0 ? (
                    <View style={styles.centered}>
                        <Text style={styles.noVendorsText}>
                            No vendors selling {category.toLowerCase()} products found.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={sortedVendors}
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
    // Sort bar styles
    sortBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    sortToggle: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        elevation: 2,
    },
    sortToggleText: {
        color: '#333333',
        fontWeight: '600',
    },
    sortButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    sortButtonActive: {
        backgroundColor: '#4CAF50',
    },
    sortButtonText: {
        color: '#333333',
        fontWeight: '700',
    },
    sortButtonTextActive: {
        color: '#FFFFFF',
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
    badgesRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    badgeIcon: {
        fontSize: 16,
        marginLeft: 6,
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