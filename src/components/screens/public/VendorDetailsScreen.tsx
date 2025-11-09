import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    TextInput,
    Image,
    ScrollView,
    Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { supabase } from '../../../services/supabase';

function ItemDivider() {
    return <View style={styles.cardItemDivider} />;
}

// Compute a safe top inset so the Close pill doesn't get clipped under the status bar
const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

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
    const [_currentTimeMs, setCurrentTimeMs] = useState<number>(Date.now());
    // No modal; navigate directly to indoor map

    

    

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
                .select('id, business_name, first_name, last_name, phone_number, stall_number, complete_address, profile_image_url, operating_hours, status')
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

            // Check if vendor is active, if not close the screen
            if (vendorData?.status && vendorData.status !== 'Active') {
                console.log('[VENDOR STATUS] Vendor is not active:', vendorData.status);
                navigation.goBack();
                return;
            }

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
    }, [vendorId, vendorProducts, navigation]);

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
                (payload) => {
                    console.log('[VENDOR PROFILE REALTIME] Change detected:', payload.eventType);
                    
                    // Check if vendor status changed to inactive
                    const newStatus = (payload.new as any)?.status;
                    if (newStatus && newStatus !== 'Active') {
                        console.log('[VENDOR PROFILE REALTIME] Vendor became inactive, closing screen');
                        navigation.goBack();
                        return;
                    }
                    
                    // Re-fetch vendor details when profile row changes
                    fetchVendorDetails();
                }
            )
            .subscribe();

        return () => {
            profileChannel.unsubscribe();
        };
    }, [vendor?.id, fetchVendorDetails, navigation]);

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

    // Directions removed

    const renderProductItem = ({ item }: { item: VendorProduct }) => {
        return (
            <View style={styles.cardItemRow}>
                <View style={styles.cardItemLeft}>
                    <Text style={styles.cardItemName}>{item.products.name}</Text>
                    <Text style={styles.cardItemSub}>₱{item.price}/{item.uom}</Text>
                </View>
            </View>
        );
    };


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
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />



            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingTop: TOP_INSET + 12 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Vendor Profile Section */}
                <View style={styles.profileSection}>
                    {(() => {
                        const hours = getOperatingHours();
                        // Dev logging to inspect operating_hours parsing when viewing vendor details
                        try {
                            if (__DEV__) console.warn(`VendorDetailsHours id=${vendor?.id} online=${hours.online} operating_hours=${String((vendor as any)?.operating_hours)}`);
                        } catch (e) { if (__DEV__) console.warn('VendorDetailsHours error', e); }
                        return (
                            <View style={styles.profileImageContainer}>
                                {profileImage ? (
                                    <Image source={{ uri: profileImage }} style={styles.profileImage} />
                                ) : (
                                    <View style={styles.profileImagePlaceholder} />
                                )}
                                {/* Open/Closed indicator overlay at lower-right of profile image */}
                                <View
                                    style={[
                                        styles.statusBadgeOverlay,
                                        hours.online ? styles.statusBadgeOpen : styles.statusBadgeClosed,
                                    ]}
                                >
                                    <Text style={styles.statusBadgeText}>{hours.online ? 'Open' : 'Closed'}</Text>
                                </View>
                            </View>
                        );
                    })()}

                    <Text style={styles.vendorName}>{vendor.business_name}</Text>
                    {vendor.stall?.stall_number && (
                        <Text style={styles.stallText}>Stall {vendor.stall.stall_number}</Text>
                    )}
                    {(vendor.first_name || vendor.last_name) && (
                        <Text style={styles.vendorOwnerName}>
                            {[vendor.first_name, vendor.last_name].filter(Boolean).join(' ')}
                        </Text>
                    )}

                    <View style={styles.vendorDetails}>
                        {vendor.phone_number && (
                            <Text style={styles.detailText}>📞 Contact No.: {vendor.phone_number}</Text>
                        )}
                        {(() => {
                            const hours = getOperatingHours();
                            // Show only the hours line; omit separate Open/Closed label
                            try {
                                if (__DEV__) console.warn(`VendorDetailsHoursInline id=${vendor?.id} online=${hours.online} operating_hours=${String((vendor as any)?.operating_hours)}`);
                            } catch (e) { if (__DEV__) console.warn('VendorDetailsHoursInline error', e); }
                            return (
                                <View style={styles.operatingHoursContainer}>
                                    <Text style={styles.detailText}>
                                        ⏰ {hours.text}
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
                            placeholderTextColor="#999999"
                        />
                    </View>
                </View>

                {/* Products Card */}
                <View style={styles.productsCard}>
                    <View style={styles.productsCardHeader}>
                        <Text style={styles.productsCardTitle}>Product Summary</Text>
                    </View>
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
                            ItemSeparatorComponent={ItemDivider}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </ScrollView>
            {/* Directions Button - navigate straight to map */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.directionButton}
                    activeOpacity={0.85}
                    onPress={() => {
                        if (vendor.stall?.stall_number) {
                            navigation.navigate('Market', {
                                focusStall: vendor.stall.stall_number,
                                stallName: vendor.business_name,
                            });
                        }
                    }}
                >
                    <Text style={styles.directionButtonText}>Directions</Text>
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
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginTop: TOP_INSET + 16,
        backgroundColor: '#FFFFFF',
        overflow: 'visible',
    },
    closeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#FFC0CB',
        borderWidth: 0,
    },
    closeButtonText: {
        fontSize: 14,
        color: '#111111',
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    profileSection: {
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    profileImageContainer: {
        width: 160,
        height: 160,
        marginBottom: 12,
        borderRadius: 80,
        backgroundColor: '#E5E5E5',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    profileImagePlaceholder: {
        width: 120,
        height: 120,
        backgroundColor: '#D9D9D9',
        borderRadius: 60,
    },
    vendorName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#000000',
        marginTop: 4,
        marginBottom: 4,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    stallText: {
        fontSize: 14,
        color: '#9A9A9A',
        textAlign: 'center',
        marginBottom: 6,
    },
    vendorOwnerName: {
        fontSize: 14,
        color: '#777777',
        marginBottom: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    vendorDetails: {
        alignItems: 'center',
        gap: 6,
    },
    detailText: {
        fontSize: 14,
        color: '#444444',
        textAlign: 'center',
        lineHeight: 20,
    },
    operatingHoursContainer: {
        marginTop: 8,
        marginBottom: 8,
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        alignSelf: 'center',
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 18,
        paddingTop: 2,
    },
    // Small Open/Closed badge overlayed on the profile image (bottom-right)
    statusBadgeOverlay: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    statusBadgeOpen: {
        backgroundColor: '#22C55E',
    },
    statusBadgeClosed: {
        backgroundColor: '#DC2626',
    },
    statusBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    detailTime: {
        fontSize: 16,
        color: '#111111',
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 2,
    },
    searchContainer: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFEFEF',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111111',
        fontWeight: '500',
    },
    productsHeader: {
        flexDirection: 'row',
        backgroundColor: '#000000',
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: 'center',
    },
    // Width accounts for row's left padding (15) + emoji box (40) + spacing (15) = 70
    iconHeaderSpacer: {
        width: 70,
    },
    columnHeader: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
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
        backgroundColor: '#FFFFFF',
        paddingBottom: 16,
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginVertical: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    productImageContainer: {
        marginRight: 12,
    },
    productImage: {
        width: 40,
        height: 40,
        borderRadius: 6,
        backgroundColor: '#F5F5F5',
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
        color: '#111111',
        fontWeight: '500',
    },
    productPrice: {
        fontSize: 14,
        color: '#111111',
        fontWeight: '600',
        textAlign: 'center',
        width: 70,
    },
    productUnit: {
        fontSize: 14,
        color: '#111111',
        textAlign: 'center',
        width: 50,
    },
    // New card-based product list styles
    productsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    productsCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    productsCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#222222',
    },
    manageButton: {
        backgroundColor: '#333333',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    manageButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    cardItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    cardItemLeft: { flex: 1, paddingRight: 12 },
    cardItemName: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '700',
        lineHeight: 22,
    },
    cardItemSub: {
        marginTop: 2,
        fontSize: 13,
        color: '#6B7280',
    },
    cardItemDivider: {
        height: 1,
        backgroundColor: '#F0F0F0',
        marginHorizontal: 12,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    badgeAvailable: {
        backgroundColor: '#E8F7EE',
        borderColor: '#34C759',
    },
    badgeUnavailable: {
        backgroundColor: '#F5F5F5',
        borderColor: '#D1D5DB',
    },
    badgeText: { fontSize: 12, fontWeight: '700' },
    badgeTextAvailable: { color: '#22C55E' },
    badgeTextUnavailable: { color: '#6B7280' },
    noProductsContainer: {
        padding: 24,
        alignItems: 'center',
    },
    noProductsText: {
        fontSize: 15,
        color: '#666666',
        textAlign: 'center',
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
        backgroundColor: '#000000',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 16,
    },
    bottomBar: {
        padding: 12,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#EFEFEF',
    },
    directionButton: {
        backgroundColor: '#111111',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    directionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default VendorDetailsScreen;