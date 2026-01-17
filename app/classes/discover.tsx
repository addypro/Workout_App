/**
 * Discover Classes (Athlete)
 *
 * Browse and join available workout classes.
 * CRITICAL: This is the only way for athletes to join classes!
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import {
    ClassSession,
    getAvailableSessions,
    joinClassSession,
} from '@/lib/services/classes';

type FilterType = 'all' | 'today' | 'week';

export default function DiscoverClassesScreen() {
    const router = useRouter();
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');
    const [joiningId, setJoiningId] = useState<string | null>(null);

    useEffect(() => {
        loadSessions();
    }, [filter]);

    const loadSessions = async () => {
        const result = await getAvailableSessions(filter);
        if (result.data) {
            setSessions(result.data);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadSessions();
    };

    const handleJoin = async (session: ClassSession) => {
        Alert.alert(
            'Join Class',
            `Join "${session.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Join',
                    onPress: async () => {
                        setJoiningId(session.id);
                        const result = await joinClassSession(session.id);
                        setJoiningId(null);

                        if (result.error) {
                            Alert.alert('Error', result.error);
                        } else {
                            Alert.alert('Joined!', 'You\'ve been added to this class.', [
                                { text: 'View Class', onPress: () => router.push(`/classes/${session.id}`) },
                                { text: 'OK' },
                            ]);
                            // Remove from available list
                            setSessions((prev) => prev.filter((s) => s.id !== session.id));
                        }
                    },
                },
            ]
        );
    };

    const formatSessionTime = (session: ClassSession) => {
        const date = new Date(session.startAt);
        const isToday = date.toDateString() === new Date().toDateString();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = date.toDateString() === tomorrow.toDateString();

        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });

        if (isToday) return `Today at ${timeStr}`;
        if (isTomorrow) return `Tomorrow at ${timeStr}`;

        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const renderSession = ({ item }: { item: ClassSession }) => {
        const spotsLeft = item.capacity - item.currentParticipantCount;
        const isJoining = joiningId === item.id;

        return (
            <View style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                    <View style={styles.sessionIcon}>
                        <Ionicons name="fitness" size={22} color={Colors.dark.primary} />
                    </View>
                    <View style={styles.sessionInfo}>
                        <Text style={styles.sessionName}>{item.name}</Text>
                        <Text style={styles.sessionTime}>{formatSessionTime(item)}</Text>
                    </View>
                </View>

                {item.description && (
                    <Text style={styles.sessionDescription} numberOfLines={2}>
                        {item.description}
                    </Text>
                )}

                <View style={styles.sessionMeta}>
                    <View style={styles.metaItem}>
                        <Ionicons name="barbell-outline" size={14} color={Colors.dark.textSecondary} />
                        <Text style={styles.metaText}>{item.exercisesJson?.length ?? 0} exercises</Text>
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
                            <Text style={styles.metaText} numberOfLines={1}>{item.locationName}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.sessionFooter}>
                    <View style={[
                        styles.spotsBadge,
                        spotsLeft <= 3 && styles.spotsBadgeLow,
                    ]}>
                        <Text style={[
                            styles.spotsText,
                            spotsLeft <= 3 && styles.spotsTextLow,
                        ]}>
                            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={() => handleJoin(item)}
                        disabled={isJoining}
                    >
                        {isJoining ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="add-circle" size={18} color="#fff" />
                                <Text style={styles.joinButtonText}>Join</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyTitle}>No Classes Available</Text>
            <Text style={styles.emptySubtitle}>
                {filter === 'today'
                    ? 'No classes scheduled for today'
                    : filter === 'week'
                        ? 'No classes scheduled this week'
                        : 'Check back later for new classes'}
            </Text>
        </View>
    );

    const renderFilterTab = (value: FilterType, label: string) => (
        <TouchableOpacity
            style={[styles.filterTab, filter === value && styles.filterTabActive]}
            onPress={() => setFilter(value)}
        >
            <Text style={[styles.filterTabText, filter === value && styles.filterTabTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Discover Classes</Text>
                <View style={styles.headerRight} />
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterBar}>
                {renderFilterTab('all', 'All')}
                {renderFilterTab('today', 'Today')}
                {renderFilterTab('week', 'This Week')}
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
    filterBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.dark.card,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    filterTabActive: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    filterTabText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.dark.textSecondary,
    },
    filterTabTextActive: {
        color: '#fff',
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
        marginBottom: 8,
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
    sessionDescription: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },
    sessionMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
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
    sessionFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    spotsBadge: {
        backgroundColor: Colors.dark.primary + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    spotsBadgeLow: {
        backgroundColor: Colors.dark.warning + '20',
    },
    spotsText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    spotsTextLow: {
        color: Colors.dark.warning,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.success,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    joinButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
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
});
