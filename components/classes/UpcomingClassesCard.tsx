/**
 * Upcoming Classes Card
 *
 * Displays athlete's upcoming classes on home screen.
 * Shows joined sessions with check-in/join actions.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import {
    ClassSession,
    getMyJoinedSessions,
} from '@/lib/services/classes';

interface Props {
    onRefreshComplete?: () => void;
}

export function UpcomingClassesCard({ onRefreshComplete }: Props) {
    const router = useRouter();
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);

    // Check feature flag (must be after hooks per Rules of Hooks)
    const featureEnabled = isFeatureEnabled('workout_classes');

    useEffect(() => {
        // Only load if feature is enabled
        if (featureEnabled) {
            loadSessions();
        } else {
            setLoading(false);
        }
    }, [featureEnabled]);

    const loadSessions = async () => {
        const result = await getMyJoinedSessions();
        if (result.data) {
            setSessions(result.data.slice(0, 3)); // Show max 3
        }
        setLoading(false);
        onRefreshComplete?.();
    };

    // Conditional returns AFTER all hooks
    if (!featureEnabled || loading || sessions.length === 0) {
        return null;
    }

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

    const handleSessionPress = (session: ClassSession) => {
        router.push(`/classes/${session.id}`);
    };

    const handleViewAll = () => {
        router.push('/classes');
    };

    const renderSession = ({ item }: { item: ClassSession }) => {
        const isUpcoming = new Date(item.startAt).getTime() - Date.now() < 60 * 60 * 1000; // Within 1hr

        return (
            <TouchableOpacity
                style={[styles.sessionCard, isUpcoming && styles.sessionCardUrgent]}
                onPress={() => handleSessionPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.sessionIcon}>
                    <Ionicons
                        name={isUpcoming ? 'fitness' : 'people'}
                        size={20}
                        color={isUpcoming ? Colors.dark.success : Colors.dark.primary}
                    />
                </View>
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.sessionTime}>{formatSessionTime(item)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="calendar-outline" size={18} color={Colors.dark.primary} />
                    <Text style={styles.headerTitle}>Upcoming Classes</Text>
                </View>
                <TouchableOpacity onPress={handleViewAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={sessions}
                renderItem={renderSession}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.dark.card,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    viewAllText: {
        fontSize: 14,
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: Colors.dark.background,
        borderRadius: 12,
        marginBottom: 8,
    },
    sessionCardUrgent: {
        backgroundColor: Colors.dark.success + '15',
        borderWidth: 1,
        borderColor: Colors.dark.success + '30',
    },
    sessionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.dark.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    sessionInfo: {
        flex: 1,
    },
    sessionName: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
        marginBottom: 2,
    },
    sessionTime: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
    },
});
