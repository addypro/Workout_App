/**
 * Gym Picker Modal
 * 
 * Location-based gym selection using free OpenStreetMap data.
 * Allows users to search nearby gyms or add custom ones.
 */

import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GymInfo } from '@/lib/context/preferences-context';
import {
    createCustomGym,
    formatDistance,
    getCurrentLocation,
    searchGymsByName,
    searchNearbyGyms,
    type GymLocation,
} from '@/lib/services/gym/gym-service';

interface GymPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectGym: (gym: GymInfo) => void;
    currentGym?: GymInfo | null;
}

export function GymPickerModal({
    visible,
    onClose,
    onSelectGym,
    currentGym,
}: GymPickerModalProps) {
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [nearbyGyms, setNearbyGyms] = useState<GymLocation[]>([]);
    const [searchResults, setSearchResults] = useState<GymLocation[]>([]);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customGymName, setCustomGymName] = useState('');

    // Load nearby gyms when modal opens
    useEffect(() => {
        if (visible && nearbyGyms.length === 0) {
            loadNearbyGyms();
        }
    }, [visible]);

    const loadNearbyGyms = async () => {
        setLoading(true);
        try {
            const location = await getCurrentLocation();
            if (location) {
                setUserLocation(location);
                const gyms = await searchNearbyGyms(location.latitude, location.longitude);
                setNearbyGyms(gyms);
            } else {
                Alert.alert(
                    'Location Required',
                    'Please enable location access to find nearby gyms, or search by name.'
                );
            }
        } catch (error) {
            console.error('Error loading nearby gyms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        try {
            const results = await searchGymsByName(
                query,
                userLocation?.latitude,
                userLocation?.longitude
            );
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching gyms:', error);
        }
    };

    const handleSelectGym = (gym: GymLocation) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const gymInfo: GymInfo = {
            id: gym.id,
            name: gym.name,
            osmId: gym.osmId,
            latitude: gym.latitude,
            longitude: gym.longitude,
            address: gym.address,
        };

        onSelectGym(gymInfo);
        onClose();
    };

    const handleCreateCustomGym = () => {
        if (!customGymName.trim()) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const gym = createCustomGym(
            customGymName,
            userLocation?.latitude || 0,
            userLocation?.longitude || 0
        );

        const gymInfo: GymInfo = {
            id: gym.id,
            name: gym.name,
            latitude: gym.latitude,
            longitude: gym.longitude,
        };

        onSelectGym(gymInfo);
        onClose();
        setCustomGymName('');
        setShowCustomInput(false);
    };

    const displayGyms = searchQuery.length >= 3 ? searchResults : nearbyGyms;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
                    <Pressable onPress={onClose} hitSlop={12}>
                        <IconSymbol name="xmark" size={24} color={colors.text} />
                    </Pressable>
                    <ThemedText style={styles.title}>Select Your Gym</ThemedText>
                    <View style={{ width: 24 }} />
                </View>

                {/* Search Input */}
                <View style={styles.searchContainer}>
                    <View style={[styles.searchBox, { backgroundColor: colors.elevated, borderColor: colors.separator }]}>
                        <IconSymbol name="magnifyingglass" size={18} color={colors.textTertiary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Search gyms..."
                            placeholderTextColor={colors.textTertiary}
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />
                    </View>
                </View>

                {/* Gym List */}
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.tint} />
                            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                                Finding nearby gyms...
                            </ThemedText>
                        </View>
                    ) : displayGyms.length > 0 ? (
                        <>
                            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                                {searchQuery.length >= 3 ? 'Search Results' : 'Nearby Gyms'}
                            </ThemedText>
                            {displayGyms.map((gym) => (
                                <Pressable
                                    key={gym.id}
                                    style={({ pressed }) => [
                                        styles.gymItem,
                                        { backgroundColor: pressed ? colors.elevated : 'transparent' },
                                    ]}
                                    onPress={() => handleSelectGym(gym)}
                                >
                                    <View style={styles.gymInfo}>
                                        <ThemedText style={styles.gymName}>{gym.name}</ThemedText>
                                        {gym.distance && (
                                            <ThemedText style={[styles.gymDistance, { color: colors.textSecondary }]}>
                                                {formatDistance(gym.distance)}
                                            </ThemedText>
                                        )}
                                    </View>
                                    <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
                                </Pressable>
                            ))}
                        </>
                    ) : searchQuery.length >= 3 ? (
                        <View style={styles.emptyState}>
                            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No gyms found for "{searchQuery}"
                            </ThemedText>
                            <ThemedText style={[styles.emptyHint, { color: colors.textTertiary }]}>
                                Tap below to add it manually
                            </ThemedText>
                            <View style={[styles.customInputRow, { marginTop: Spacing.md }]}>
                                <TextInput
                                    style={[styles.customInput, { color: colors.text, backgroundColor: colors.elevated, borderColor: colors.separator }]}
                                    placeholder="Enter gym name..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={customGymName || searchQuery}
                                    onChangeText={setCustomGymName}
                                    autoFocus
                                />
                                <Pressable
                                    style={[styles.addButton, { backgroundColor: colors.tint }]}
                                    onPress={() => {
                                        const nameToSave = customGymName || searchQuery;
                                        if (nameToSave.trim()) {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            const gym = createCustomGym(
                                                nameToSave,
                                                userLocation?.latitude || 0,
                                                userLocation?.longitude || 0
                                            );
                                            onSelectGym({
                                                id: gym.id,
                                                name: gym.name,
                                                latitude: gym.latitude,
                                                longitude: gym.longitude,
                                            });
                                            onClose();
                                        }
                                    }}
                                >
                                    <ThemedText style={styles.addButtonText}>Add</ThemedText>
                                </Pressable>
                            </View>
                        </View>
                    ) : null}

                    {/* Add Custom Gym */}
                    <View style={styles.customSection}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                            Can't find your gym?
                        </ThemedText>

                        {showCustomInput ? (
                            <View style={styles.customInputRow}>
                                <TextInput
                                    style={[styles.customInput, { color: colors.text, backgroundColor: colors.elevated, borderColor: colors.separator }]}
                                    placeholder="Enter gym name..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={customGymName}
                                    onChangeText={setCustomGymName}
                                    autoFocus
                                />
                                <Pressable
                                    style={[styles.addButton, { backgroundColor: colors.tint }]}
                                    onPress={handleCreateCustomGym}
                                >
                                    <ThemedText style={styles.addButtonText}>Add</ThemedText>
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={[styles.addCustomButton, { borderColor: colors.tint }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setShowCustomInput(true);
                                }}
                            >
                                <IconSymbol name="plus" size={18} color={colors.tint} />
                                <ThemedText style={[styles.addCustomText, { color: colors.tint }]}>
                                    Add Custom Gym
                                </ThemedText>
                            </Pressable>
                        )}
                    </View>
                </ScrollView>
            </View >
        </Modal >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    title: {
        ...Typography.title3,
        fontWeight: '600',
    },
    searchContainer: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.md,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    searchInput: {
        flex: 1,
        ...Typography.body,
        paddingVertical: Spacing.xs,
    },
    list: {
        flex: 1,
        paddingHorizontal: Spacing.md,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xxl,
        gap: Spacing.md,
    },
    loadingText: {
        ...Typography.body,
    },
    sectionTitle: {
        ...Typography.caption1,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    gymItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.sm,
    },
    gymInfo: {
        flex: 1,
        gap: 2,
    },
    gymName: {
        ...Typography.body,
        fontWeight: '500',
    },
    gymDistance: {
        ...Typography.caption1,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    emptyText: {
        ...Typography.body,
        textAlign: 'center',
    },
    emptyHint: {
        ...Typography.caption1,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    customSection: {
        marginTop: Spacing.xl,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(128, 128, 128, 0.2)',
    },
    customInputRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    customInput: {
        flex: 1,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
        borderWidth: 1,
        ...Typography.body,
    },
    addButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.sm,
        justifyContent: 'center',
    },
    addButtonText: {
        color: '#fff',
        ...Typography.subhead,
        fontWeight: '600',
    },
    addCustomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        borderRadius: Radius.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
    },
    addCustomText: {
        ...Typography.subhead,
        fontWeight: '500',
    },
});
