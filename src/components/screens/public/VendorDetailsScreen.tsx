import React, { useEffect, useState, useRef } from 'react';
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
    TextInput,
    Image,
    ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'VendorDetails'>;

interface VendorProduct {
    id: string;
    price: number;
    uom: string;
    status: string;
    products: {
        id: string;
        name: string;
        description?: string;
        category_id?: string;
        product_categories?: { name: string } | { name: string }[];
    };
}

interface VendorInfo {
    id: string;
    business_name: string;
    phone_number?: string;
    stall?: {
        stall_number: string;
        location_description?: string;
    } | null;
}

const VendorDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
    const { vendorId, vendorName: _vendorName } = route.params;
    const [vendor, setVendor] = useState<VendorInfo | null>(null);
    const [products, setProducts] = useState<VendorProduct[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<VendorProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchVendorDetails();

        // Supabase Realtime subscription for vendor_products
        const channel = supabase.channel(`vendor-products-vendor-${vendorId}`);
        channel
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vendor_products',
                    filter: `vendor_id=eq.${vendorId}`,
                },
                (payload) => {
                    // On insert/update/delete, re-fetch products
                    fetchVendorDetails();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [vendorId]);

    useEffect(() => {
        // Filter products based on search query
        if (searchQuery.trim() === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(product =>
                product.products.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredProducts(filtered);
        }
    }, [searchQuery, products]);

    const fetchVendorDetails = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch vendor profile with stall_number from vendor_profiles table
            const { data: vendorData, error: vendorError } = await supabase
                .from('vendor_profiles')
                .select('id, business_name, phone_number, stall_number, complete_address')
                .eq('id', vendorId)
                .single();

            if (vendorError) {
                console.error('Error fetching vendor:', vendorError);
                setError('Failed to load vendor details');
                return;
            }

            console.log('Vendor data:', vendorData);

            // Fetch stall information from stalls table
            const { data: stallData, error: stallError } = await supabase
                .from('stalls')
                .select('stall_number, location_description')
                .eq('vendor_profile_id', vendorId)
                .maybeSingle();

            if (stallError) {
                console.warn('Error fetching stall data:', stallError);
            }

            console.log('Stall data:', stallData);

            // Combine vendor and stall data - prefer stalls table, fallback to vendor_profiles
            const stallInfo = stallData || (vendorData.stall_number ? {
                stall_number: vendorData.stall_number,
                location_description: vendorData.complete_address || 'Toril Public Market'
            } : {
                stall_number: 'F-1', // Default stall number for demo
                location_description: 'Toril Public Market'
            });

            const vendorWithStall: VendorInfo = {
                ...vendorData,
                stall: stallInfo
            };

            setVendor(vendorWithStall);

            // Fetch vendor products
                        const { data: productData, error: productError } = await supabase
                .from('vendor_products')
                .select(`
          id,
          price,
          uom,
          status,
          products!inner (
            id,
            name,
                        description,
                        category_id,
                        product_categories ( name )
          )
        `)
                .eq('vendor_id', vendorId)
                .in('status', ['available', 'active']); // Only show available products

            if (productError) {
                console.error('Error fetching products:', productError);
                setError('Failed to load vendor products');
                return;
            }

            setProducts((productData as unknown as VendorProduct[]) || []);
            setFilteredProducts((productData as unknown as VendorProduct[]) || []);

        } catch (err) {
            console.error('Unexpected error:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleDirections = () => {
        const stallInfo = vendor?.stall?.stall_number ?
            `Stall ${vendor.stall.stall_number}` :
            vendor?.business_name;

        Alert.alert(
            'Directions',
            `Navigate to ${stallInfo}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Get Directions', onPress: () => {
                        // Here you can integrate with maps or your indoor navigation
                        Alert.alert('Coming Soon', 'Navigation feature will be implemented soon!');
                    }
                },
            ]
        );
    };

    const getProductEmoji = (p: VendorProduct): string => {
        const lower = (s?: string) => (s || '').toLowerCase();
        const name = lower(p.products?.name);
        const cat = p.products?.product_categories;
        const catName = Array.isArray(cat) ? lower(cat[0]?.name) : lower((cat as any)?.name);

        // Beef
        if (
            catName?.includes('beef') ||
            name.includes('beef') || name.includes('baka') || name.includes('brisket') || name.includes('sirloin') || name.includes('tenderloin') ||
            name.includes('ribeye') || name.includes('ribs') || name.includes('short rib') || name.includes('shank') || name.includes('oxtail') || name.includes('kalitiran')
        ) return '🐄';

        // Pork
        if (
            catName?.includes('pork') ||
            name.includes('pork') || name.includes('baboy') || name.includes('liempo') || name.includes('lomo') || name.includes('pigue') ||
            name.includes('pata') || name.includes('tadyang') || name.includes('loin') || name.includes('chop') || name.includes('shoulder')
        ) return '🐖';

        // Chicken
        if (
            catName?.includes('chicken') ||
            name.includes('chicken') || name.includes('manok') || name.includes('drumstick') || name.includes('thigh') || name.includes('wing') || name.includes('breast')
        ) return '🍗';

        return '🧺';
    };

    const renderProductItem = ({ item }: { item: VendorProduct }) => (
        <View style={styles.productRow}>
            <View style={styles.productImageContainer}>
                <View style={styles.productImage}>
                    <Text style={styles.productEmoji}>{getProductEmoji(item)}</Text>
                </View>
            </View>
            <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.products.name}</Text>
            </View>
            <Text style={styles.productPrice}>₱{item.price}</Text>
            <Text style={styles.productUnit}>{item.uom}</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading vendor details...</Text>
            </View>
        );
    }

    if (error || !vendor) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error || 'Vendor not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchVendorDetails}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Vendor Profile Section */}
                <View style={styles.profileSection}>
                    <View style={styles.profileImageContainer}>
                        <View style={styles.profileImagePlaceholder} />
                    </View>

                    <Text style={styles.vendorName}>{vendor.business_name}</Text>

                    <View style={styles.vendorDetails}>
                        {vendor.stall?.stall_number && (
                            <Text style={styles.detailText}>
                                🏪 Stall {vendor.stall.stall_number}, {vendor.stall.location_description || 'West Section'}
                            </Text>
                        )}
                        <Text style={styles.detailText}>⏰ 5:00 AM - 5:00 PM</Text>
                        {vendor.phone_number && (
                            <Text style={styles.detailText}>📞 Contact No.: {vendor.phone_number}</Text>
                        )}
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search Product"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#999"
                        />
                    </View>
                </View>

                {/* Products Header */}
                <View style={styles.productsHeader}>
                    {/* Spacer to align with product emoji + row left padding */}
                    <View style={styles.iconHeaderSpacer} />
                    <Text style={[styles.columnHeader, styles.nameHeader]}>Product Name</Text>
                    <Text style={[styles.columnHeader, styles.priceHeader]}>Price</Text>
                    <Text style={[styles.columnHeader, styles.unitHeader]}>Unit</Text>
                </View>

                {/* Products List */}
                <View style={styles.productsContainer}>
                    {filteredProducts.length === 0 ? (
                        <View style={styles.noProductsContainer}>
                            <Text style={styles.noProductsText}>
                                {searchQuery ? 'No products found matching your search.' : 'No products available.'}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredProducts}
                            keyExtractor={(item) => item.id}
                            renderItem={renderProductItem}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </ScrollView>

            {/* Direction Button */}
            <View style={styles.bottomContainer}>
                <TouchableOpacity style={styles.directionButton} onPress={handleDirections}>
                    <Text style={styles.directionButtonText}>Direction</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        padding: 5,
    },
    backButtonText: {
        fontSize: 24,
        color: '#333333',
        fontWeight: '300',
    },
    content: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    profileImageContainer: {
        marginBottom: 16,
    },
    profileImagePlaceholder: {
        width: 120,
        height: 80,
        backgroundColor: '#E5E5E5',
        borderRadius: 12,
        borderWidth: 3,
        borderColor: '#4CAF50',
    },
    vendorName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 12,
        textAlign: 'center',
    },
    vendorDetails: {
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
    },
    searchContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4CAF50',
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    productsHeader: {
        flexDirection: 'row',
        backgroundColor: '#4CAF50',
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
    },
    // Width accounts for row's left padding (15) + emoji box (40) + spacing (15) = 70
    iconHeaderSpacer: {
        width: 70,
    },
    columnHeader: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
    },
    nameHeader: {
        flex: 1,
        textAlign: 'left',
    },
    priceHeader: {
        width: 70,
    },
    unitHeader: {
        width: 50,
    },
    productsContainer: {
        backgroundColor: '#4CAF50',
        paddingBottom: 20,
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        marginVertical: 1,
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 6,
    },
    productImageContainer: {
        marginRight: 15,
    },
    productImage: {
        width: 40,
        height: 40,
        borderRadius: 6,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productEmoji: {
        fontSize: 18,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        color: '#333333',
        fontWeight: '500',
    },
    productPrice: {
        fontSize: 14,
        color: '#333333',
        fontWeight: '600',
        textAlign: 'center',
        width: 70,
    },
    productUnit: {
        fontSize: 14,
        color: '#333333',
        textAlign: 'center',
        width: 50,
    },
    noProductsContainer: {
        padding: 40,
        alignItems: 'center',
    },
    noProductsText: {
        fontSize: 16,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    bottomContainer: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
    },
    directionButton: {
        backgroundColor: '#333333',
        borderRadius: 8,
        paddingVertical: 15,
        alignItems: 'center',
    },
    directionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
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
});

export default VendorDetailsScreen;