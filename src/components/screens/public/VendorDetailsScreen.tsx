import React, { useEffect, useState, useCallback } from 'react';
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
import { useIsFocused } from '@react-navigation/native';
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
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    stall?: {
        stall_number: string;
        location_description?: string;
    } | null;
}

const VendorDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
    const { vendorId, vendorProducts } = route.params;
    const [vendor, setVendor] = useState<VendorInfo | null>(null);
    const [products, setProducts] = useState<VendorProduct[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<VendorProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());

    

    

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

    const isUuid = (s: string) => {
        // Basic UUID v4-ish check
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    };

    const normalizeStallNumber = (raw: string) => {
        if (!raw) return raw;
        // Convert formats like 'm45', 'M 45', 'M-45', 'm-45' -> 'M-45'
        const s = raw.toString().trim();
        // Uppercase letters, remove surrounding whitespace
        const upper = s.toUpperCase().replace(/\s+/g, '');
        // Insert a dash between letters and numbers if missing
        return upper.replace(/([A-Z]+)(\d+)/, '$1-$2');
    };

    const fetchVendorDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            let resolvedVendorId: string | null = null;
            let vendorData: any = null;

            // If the passed vendorId looks like a real UUID, use it directly
            if (vendorId && isUuid(vendorId)) {
                resolvedVendorId = vendorId;
            } else {
                // Try to resolve vendor_profile_id from stalls table using normalized stall number
                const stallNumber = normalizeStallNumber(vendorId || '');
                if (stallNumber) {
                    const { data: stallRow, error: stallLookupError } = await supabase
                        .from('stalls')
                        .select('vendor_profile_id, stall_number, location_description')
                        .eq('stall_number', stallNumber)
                        .maybeSingle();

                    if (stallLookupError) {
                        console.warn('Error looking up stall by number:', stallLookupError);
                    }

                    if (stallRow && stallRow.vendor_profile_id) {
                        resolvedVendorId = stallRow.vendor_profile_id;
                    }
                }
            }

            if (!resolvedVendorId) {
                // As a last resort, if vendorProducts were passed from navigation and include a vendor_id, use that
                if (vendorProducts && vendorProducts.length > 0 && vendorProducts[0].vendor_id) {
                    resolvedVendorId = vendorProducts[0].vendor_id;
                }
            }

            if (!resolvedVendorId) {
                // Could not resolve a vendor_profile id — fail gracefully
                console.warn('Could not resolve vendor_profile id for:', vendorId);
                setError('Failed to load vendor details');
                setLoading(false);
                return;
            }

            // Fetch vendor profile now that we have a UUID vendor id
            const { data: vpData, error: vpError } = await supabase
                .from('vendor_profiles')
                .select('id, business_name, first_name, last_name, phone_number, stall_number, complete_address, profile_image_url, operating_hours')
                .eq('id', resolvedVendorId)
                .single();

            if (vpError) {
                console.error('Error fetching vendor:', vpError);
                setError('Failed to load vendor details');
                return;
            }

            vendorData = vpData;

            // Fetch stall information from stalls table by vendor_profile_id
            const { data: stallData, error: stallError } = await supabase
                .from('stalls')
                .select('stall_number, location_description')
                .eq('vendor_profile_id', resolvedVendorId)
                .maybeSingle();

            if (stallError) {
                console.warn('Error fetching stall data:', stallError);
            }

            const stallInfo = stallData || (vendorData?.stall_number ? {
                stall_number: vendorData.stall_number,
                location_description: vendorData.complete_address || 'Toril Public Market'
            } : {
                stall_number: 'F-1',
                location_description: 'Toril Public Market'
            });

            const vendorWithStall: VendorInfo = {
                ...vendorData,
                stall: stallInfo
            };

            setVendor(vendorWithStall);

            if (vendorData?.profile_image_url) {
                const cacheBuster = `?v=${Date.now()}`;
                setProfileImage(vendorData.profile_image_url + cacheBuster);
            }

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
                .eq('vendor_id', resolvedVendorId)
                .in('status', ['available', 'active']);

            if (productError) {
                console.error('Error fetching products:', productError);
                // Fallback to vendorProducts passed via navigation (when navigating from map with inline data)
                if (vendorProducts && vendorProducts.length > 0) {
                    setProducts(vendorProducts as VendorProduct[]);
                    setFilteredProducts(vendorProducts as VendorProduct[]);
                } else {
                    setProducts([]);
                    setFilteredProducts([]);
                    setError('Failed to load vendor products');
                }
            } else {
                setProducts((productData as unknown as VendorProduct[]) || []);
                setFilteredProducts((productData as unknown as VendorProduct[]) || []);
            }

        } catch (err) {
            console.error('Unexpected error:', err);
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    }, [vendorId, vendorProducts]);

    // Supabase Realtime subscription and initial fetch
    useEffect(() => {
        fetchVendorDetails();

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
                    (_payload) => {
                        // On insert/update/delete, re-fetch products
                        fetchVendorDetails();
                    }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [vendorId, fetchVendorDetails]);

    // Subscribe to vendor_profiles changes for the loaded vendor so updates (like operating_hours) show immediately
    useEffect(() => {
        if (!vendor?.id) return;
        const profileChannel = supabase.channel(`vendor-profiles-${vendor.id}`);
        profileChannel
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'vendor_profiles',
                    filter: `id=eq.${vendor.id}`,
                },
                (_payload) => {
                    // Re-fetch vendor details when profile row changes
                    fetchVendorDetails();
                }
            )
            .subscribe();

        return () => {
            profileChannel.unsubscribe();
        };
    }, [vendor?.id, fetchVendorDetails]);

    // While the screen is focused, tick current time every 30 seconds so UI (open/closed) updates automatically
    const isFocused = useIsFocused();
    useEffect(() => {
        if (!isFocused) return;
        setCurrentTimeMs(Date.now());
        const id = setInterval(() => setCurrentTimeMs(Date.now()), 30 * 1000);
        return () => clearInterval(id);
    }, [isFocused]);

    // Re-fetch vendor details when screen becomes focused so UI stays up-to-date
    useEffect(() => {
        if (isFocused) fetchVendorDetails();
    }, [isFocused, fetchVendorDetails]);

    const handleDirections = () => {
        const stallNumber = vendor?.stall?.stall_number;
        const businessName = vendor?.business_name;

        if (!stallNumber) {
            Alert.alert('No Location', 'Stall location not available');
            return;
        }

        Alert.alert(
            'Get Directions',
            `Navigate to Stall ${stallNumber}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Show on Map', 
                    onPress: () => {
                        // Navigate back to Market screen with the stall info
                        navigation.navigate('Market', {
                            focusStall: stallNumber,
                            stallName: businessName
                        });
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

    const getOperatingHours = () => {
        if (!vendor || !('operating_hours' in vendor) || !vendor.operating_hours) {
            return { text: 'Hours not available', online: false, dayName: 'Today' };
        }

        try {
            // Parse the operating hours JSON or accept object
            const schedule = typeof (vendor as any).operating_hours === 'string'
                ? JSON.parse((vendor as any).operating_hours)
                : (vendor as any).operating_hours;

            const now = new Date();
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const currentDayName = dayNames[now.getDay()];
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // Find today's schedule with tolerant key lookup
            let daySchedule: any = null;
            if (schedule && typeof schedule === 'object' && !Array.isArray(schedule)) {
                const possibleKeys = [
                    currentDayName,
                    currentDayName.toLowerCase(),
                    currentDayName.slice(0,3),
                    currentDayName.slice(0,3).toLowerCase(),
                ];
                for (const k of possibleKeys) {
                    if (Object.prototype.hasOwnProperty.call(schedule, k)) {
                        daySchedule = schedule[k];
                        break;
                    }
                }
            }

            // Support array-style schedules like [{ day: 'Saturday', start: '4:14 AM', end: '5:00 PM', open: true }, ...]
            if (!daySchedule && Array.isArray(schedule)) {
                daySchedule = schedule.find((e: any) => {
                    if (!e) return false;
                    const d = e.day || e.name || e.weekday;
                    if (!d) return false;
                    const dn = String(d).toLowerCase();
                    return dn.includes(currentDayName.toLowerCase()) || dn === currentDayName.slice(0,3).toLowerCase();
                }) || null;
            }

            if (!daySchedule) return { text: 'Closed today', online: false, dayName: currentDayName };

            // Closed flags
            if (daySchedule.isClosed === true || daySchedule.open === false) {
                return { text: 'Closed today', online: false, dayName: currentDayName };
            }

            const startStr = daySchedule.start || daySchedule.openAt || daySchedule.open_time || null;
            const endStr = daySchedule.end || daySchedule.closeAt || daySchedule.close_time || null;
            if (!startStr || !endStr) return { text: 'Hours not set', online: false, dayName: currentDayName };

            const parseToMinutes = (t: string | null): number | null => {
                if (!t) return null;
                const s = String(t).trim();
                const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp]\.?\s*[Mm]\.?))?$/);
                if (!m) return null;
                let hh = parseInt(m[1].replace(/^0+/, '') || '0', 10);
                const mm = parseInt(m[2], 10);
                const ampmRaw = m[3];
                if (ampmRaw) {
                    const up = ampmRaw.replace(/\./g, '').toUpperCase();
                    if (up.startsWith('P') && hh !== 12) hh += 12;
                    if (up.startsWith('A') && hh === 12) hh = 0;
                }
                return hh * 60 + mm;
            };

            const startMin = parseToMinutes(startStr);
            const endMin = parseToMinutes(endStr);
            if (startMin === null || endMin === null) return { text: `${startStr} - ${endStr}`, online: false, dayName: currentDayName };

            let isOpen = false;
            if (startMin <= endMin) {
                isOpen = currentMinutes >= startMin && currentMinutes <= endMin;
            } else {
                // Overnight
                isOpen = currentMinutes >= startMin || currentMinutes <= endMin;
            }

            return { text: `${startStr} - ${endStr}`, online: isOpen, dayName: currentDayName };
        } catch (err) {
            console.error('Error parsing operating hours:', err);
            return { text: 'Hours not available', online: false, dayName: 'Today' };
        }
    };

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
            <StatusBar barStyle="dark-content" backgroundColor="#aa1515ff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Vendor Profile Section */}
                <View style={styles.profileSection}>
                    {(() => {
                        const hours = getOperatingHours();
                        const isOpen = hours.online;
                        const borderColor = isOpen ? '#4CAF50' : '#E53935';
                        // Dev logging to inspect operating_hours parsing when viewing vendor details
                        try {
                            if (__DEV__) console.warn(`VendorDetailsHours id=${vendor?.id} online=${hours.online} operating_hours=${String((vendor as any)?.operating_hours)}`);
                        } catch (e) { if (__DEV__) console.warn('VendorDetailsHours error', e); }
                        
                        return (
                            <View style={[styles.profileImageContainer, { borderColor }]}>
                                {profileImage ? (
                                    <Image source={{ uri: profileImage }} style={styles.profileImage} />
                                ) : (
                                    <View style={styles.profileImagePlaceholder} />
                                )}
                            </View>
                        );
                    })()}

                    <Text style={styles.vendorName}>{vendor.business_name}</Text>
                    {(vendor.first_name || vendor.last_name) && (
                        <Text style={styles.vendorOwnerName}>
                            {[vendor.first_name, vendor.last_name].filter(Boolean).join(' ')}
                        </Text>
                    )}

                    <View style={styles.vendorDetails}>
                        {vendor.stall?.stall_number && (
                            <Text style={styles.detailText}>
                                🏪 Stall {vendor.stall.stall_number}, {vendor.stall.location_description || 'West Section'}
                            </Text>
                        )}
                        {vendor.phone_number && (
                            <Text style={styles.detailText}>📞 Contact No.: {vendor.phone_number}</Text>
                        )}
                        {(() => {
                            const hours = getOperatingHours();
                            const statusColor = hours.online ? '#22C55E' : '#E53935';
                            try {
                                if (__DEV__) console.warn(`VendorDetailsHoursInline id=${vendor?.id} online=${hours.online} operating_hours=${String((vendor as any)?.operating_hours)}`);
                            } catch (e) { if (__DEV__) console.warn('VendorDetailsHoursInline error', e); }
                            return (
                                <View style={styles.operatingHoursContainer}>
                                    <Text style={styles.detailText}>
                                        ⏰ {hours.dayName}: {hours.text}
                                    </Text>
                                    <Text style={[styles.statusText, { color: statusColor }]}>
                                        {hours.online ? '● Open' : '● Closed'}
                                    </Text>
                                </View>
                            );
                        })()}
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
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#F5F5F5',
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
    profileImage: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: '#4CAF50',
    },
    profileImagePlaceholder: {
        width: 140,
        height: 140,
        backgroundColor: '#E5E5E5',
        borderRadius: 70,
        borderWidth: 4,
        borderColor: '#4CAF50',
    },
    vendorName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333333',
        marginBottom: 4,
        textAlign: 'center',
    },
    vendorOwnerName: {
        fontSize: 16,
        color: '#666666',
        marginBottom: 12,
        textAlign: 'center',
        fontStyle: 'italic',
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
    operatingHoursContainer: {
        marginTop: 8,
        alignItems: 'center',
        gap: 4,
    },
    statusText: {
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    detailTime: {
        fontSize: 16,
        color: '#E53935',
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 2,
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