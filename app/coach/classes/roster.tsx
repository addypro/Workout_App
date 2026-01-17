/**
 * Class Session Roster (Coach)
 *
 * View session participants and their check-in status.
 * Manual check-in capability for coaches.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
    ClassParticipant,
    ClassSession,
    coachCheckInAthlete,
    getCheckedInAthletes,
    getClassSession,
    getSessionRoster
} from '@/lib/services/classes';

interface RosterItem {
    participant: ClassParticipant;
    isCheckedIn: boolean;
}

export default function ClassRosterScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [session, setSession] = useState<ClassSession | null>(null);
    const [roster, setRoster] = useState<RosterItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [checkingInId, setCheckingInId] = useState<string | null>(null);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        if (!id) return;

        const [sessionResult, rosterResult, checkinsResult] = await Promise.all([
            getClassSession(id),
            getSessionRoster(id),
            getCheckedInAthletes(id),
        ]);

        if (sessionResult.data) {
            setSession(sessionResult.data);
        }

        if (rosterResult.data && checkinsResult.data) {
            const checkedInIds = new Set(checkinsResult.data.map((c) => c.athleteUserId));
            const items: RosterItem[] = rosterResult.data.map((p) => ({
                participant: p,
                isCheckedIn: checkedInIds.has(p.athleteUserId),
            }));
            // Sort: checked-in first, then by join date
            items.sort((a, b) => {
                if (a.isCheckedIn !== b.isCheckedIn) return b.isCheckedIn ? 1 : -1;
                return new Date(a.participant.joinedAt).getTime() - new Date(b.participant.joinedAt).getTime();
            });
            setRoster(items);
        }

        setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleManualCheckIn = async (athleteUserId: string) => {
        if (!id) return;

        Alert.alert(
            'Manual Check-In',
            'Mark this athlete as checked in?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Check In',
                    onPress: async () => {
                        setCheckingInId(athleteUserId);
                        const result = await coachCheckInAthlete(id, athleteUserId);
                        setCheckingInId(null);

                        if (result.error) {
                            Alert.alert('Error', result.error);
                        } else {
                            // Update local state
                            setRoster((prev) =>
                                prev.map((item) =>
                                    item.participant.athleteUserId === athleteUserId
                                        ? { ...item, isCheckedIn: true }
                                        : item
                                )
                            );
                        }
                    },
                },
            ]
        );
    };

    const renderParticipant = ({ item }: { item: RosterItem }) => {
        const { participant, isCheckedIn } = item;
        const isCheckingIn = checkingInId === participant.athleteUserId;

        return (
            <View style={styles.participantCard}>
                <View style={styles.participantInfo}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={20} color={Colors.dark.textSecondary} />
                    </View>
                    <View style={styles.participantDetails}>
                        <Text style={styles.participantName}>
                            Athlete {participant.athleteUserId.slice(0, 8)}...
                        </Text>
                        <Text style={styles.joinedAt}>
                            Joined {new Date(participant.joinedAt).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                {isCheckedIn ? (
                    <View style={styles.checkedInBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.dark.success} />
                        <Text style={styles.checkedInText}>Checked In</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.checkInButton}
                        onPress={() => handleManualCheckIn(participant.athleteUserId)}
                        disabled={isCheckingIn}
                    >
                        {isCheckingIn ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="checkbox-outline" size={18} color="#fff" />
                                <Text style={styles.checkInButtonText}>Check In</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyTitle}>No Participants Yet</Text>
            <Text style={styles.emptySubtitle}>
                Athletes haven't joined this class yet
            </Text>
        </View>
    );

    const checkedInCount = roster.filter((r) => r.isCheckedIn).length;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Class Roster</Text>
                    {session && (
                        <Text style={styles.headerSubtitle}>{session.name}</Text>
                    )}
                </View>
                <View style={styles.headerRight} />
            </View>

            {/* Stats Bar */}
            {session && (
                <View style={styles.statsBar}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{roster.length}</Text>
                        <Text style={styles.statLabel}>Joined</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: Colors.dark.success }]}>
                            {checkedInCount}
                        </Text>
                        <Text style={styles.statLabel}>Checked In</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{session.capacity}</Text>
                        <Text style={styles.statLabel}>Capacity</Text>
                    </View>
                </View>
            )}

            {/* Content */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            ) : (
                <FlatList
                    data={roster}
                    renderItem={renderParticipant}
                    keyExtractor={(item) => item.participant.id}
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
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    headerRight: {
        width: 32,
    },
    statsBar: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.card,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        backgroundColor: Colors.dark.border,
        marginVertical: 4,
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    participantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.dark.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    participantInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    participantDetails: {
        flex: 1,
    },
    participantName: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    joinedAt: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    checkedInBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.success + '20',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    checkedInText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.dark.success,
    },
    checkInButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 4,
    },
    checkInButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
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
