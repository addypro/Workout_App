/**
 * My Classes List (Athlete)
 *
 * Shows athlete's joined classes and available sessions.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import {
    ClassSession,
    getMyJoinedSessions
} from '@/lib/services/classes';

export default function MyClassesScreen() {
    const router = useRouter();
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pendingReviewCount, setPendingReviewCount] = useState(0);

    // Feature gate check
    if (!isFeatureEnabled('workout_classes')) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Ionicons name="lock-closed" size={48} color={Colors.dark.textSecondary} />
                    <Text style={styles.disabledText}>Workout Classes coming soon!</Text>
                </View>
            </SafeAreaView>
        );
    }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [sessionsResult, pendingResult] = await Promise.all([
            getMyJoinedSessions(),
            getMyPendingReviewLogs(),
        ]);

        if (sessionsResult.data) {
            setSessions(sessionsResult.data);
        }
        if (pendingResult.data) {
            setPendingReviewCount(pendingResult.data.length);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleSessionPress = (session: ClassSession) => {
        router.push(`/classes/${session.id}`);
    };

    const handleDiscoverPress = () => {
        router.push('/classes/discover');
    };

    const formatSessionTime = (session: ClassSession) => {
        const date = new Date(session.startAt);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const getSessionStatus = (session: ClassSession) => {
        const now = Date.now();
        const start = new Date(session.startAt).getTime();
        const diff = start - now;

        if (session.status === 'in_progress') return { text: 'In Progress', color: Colors.dark.success };
        if (diff < 0) return { text: 'Started', color: Colors.dark.warning };
        if (diff < 60 * 60 * 1000) return { text: 'Starting Soon', color: Colors.dark.success };
        if (diff < 24 * 60 * 60 * 1000) return { text: 'Today', color: Colors.dark.primary };
        return { text: 'Upcoming', color: Colors.dark.textSecondary };
    };

    const renderSession = ({ item }: { item: ClassSession }) => {
        const status = getSessionStatus(item);

        return (
            <TouchableOpacity
                style={styles.sessionCard}
                onPress={() => handleSessionPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.sessionHeader}>
                    <View style={styles.sessionIcon}>
                        <Ionicons name="people" size={22} color={Colors.dark.primary} />
                    </View>
                    <View style={styles.sessionInfo}>
                        <Text style={styles.sessionName}>{item.name}</Text>
                        <Text style={styles.sessionTime}>{formatSessionTime(item)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                    </View>
                </View>

                <View style={styles.sessionMeta}>
                    <View style={styles.metaItem}>
                        <Ionicons name="barbell-outline" size={14} color={Colors.dark.textSecondary} />
                        <Text style={styles.metaText}>
                            {(item.exercisesJson?.length ?? 0)} exercises
                        </Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={14} color={Colors.dark.textSecondary} />
                        <Text style={styles.metaText}>
                            {item.currentParticipantCount}/{item.capacity} joined
                        </Text>
                    </View>
                    {item.locationName && (
                        <View style={styles.metaItem}>
                            <Ionicons name="location-outline" size={14} color={Colors.dark.textSecondary} />
                            <Text style={styles.metaText}>{item.locationName}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyTitle}>No Upcoming Classes</Text>
            <Text style={styles.emptySubtitle}>
                Discover and join classes from your coaches
            </Text>
            <TouchableOpacity style={styles.discoverButton} onPress={handleDiscoverPress}>
                <Ionicons name="compass-outline" size={20} color="#fff" />
                <Text style={styles.discoverButtonText}>Discover Classes</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Classes</Text>
                <TouchableOpacity onPress={handleDiscoverPress} style={styles.discoverHeaderButton}>
                    <Ionicons name="compass-outline" size={22} color={Colors.dark.primary} />
                    {pendingReviewCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{pendingReviewCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    renderItem={renderSession}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} />
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledText: {
        marginTop: 16,
        fontSize: 16,
        color: Colors.dark.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    headerRight: {
        width: 32,
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    sessionCard: {
        backgroundColor: Colors.dark.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    sessionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sessionIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 2,
    },
    sessionTime: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    sessionMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        gap: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: Colors.dark.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    discoverButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 20,
        gap: 8,
    },
    discoverButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    discoverHeaderButton: {
        padding: 4,
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: Colors.dark.error,
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
});
