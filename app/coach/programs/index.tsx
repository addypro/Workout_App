/**
 * Coach Programs Library Screen
 *
 * Displays the coach's program library with options to:
 * - Create new programs
 * - Edit existing programs
 * - Duplicate programs
 * - Assign programs to athletes
 */

import { useAppTheme } from '@/lib/context/theme-context';
import { CoachProgram, getMyPrograms, ProgramCategory } from '@/lib/services/coach';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ============================================
// Component
// ============================================

export default function ProgramsLibraryScreen() {
    const { colors } = useAppTheme();
    const router = useRouter();

    // State
    const [programs, setPrograms] = useState<CoachProgram[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Load programs
    const loadPrograms = useCallback(async () => {
        try {
            const result = await getMyPrograms(1, 100);
            if (result.success && result.data) {
                setPrograms(result.data.data);
            }
        } catch (error) {
            console.error('Error loading programs:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadPrograms();
    }, [loadPrograms]);

    // Handlers
    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        loadPrograms();
    }, [loadPrograms]);

    const handleCreateProgram = useCallback(() => {
        router.push('/coach/programs/builder');
    }, [router]);

    const handleEditProgram = useCallback(
        (programId: string) => {
            router.push(`/coach/programs/builder?id=${programId}`);
        },
        [router]
    );

    const handleAssignProgram = useCallback(
        (programId: string) => {
            router.push(`/coach/assign-program?programId=${programId}`);
        },
        [router]
    );

    // Get category color
    const getCategoryColor = (category?: ProgramCategory): string[] => {
        switch (category) {
            case 'strength':
                return ['#FF6B6B', '#EE5A5A'];
            case 'hypertrophy':
                return ['#4ECDC4', '#45B7AA'];
            case 'powerlifting':
                return ['#A855F7', '#9333EA'];
            case 'bodybuilding':
                return ['#F59E0B', '#D97706'];
            case 'sport_specific':
                return ['#3B82F6', '#2563EB'];
            default:
                return [colors.primary, colors.primaryDark || colors.primary];
        }
    };

    // Render program card
    const renderProgramCard = ({ item }: { item: CoachProgram }) => {
        const gradientColors = getCategoryColor(item.category);

        return (
            <TouchableOpacity
                style={styles.programCard}
                onPress={() => handleEditProgram(item.id)}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={gradientColors as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                >
                    <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.programName} numberOfLines={2}>
                                {item.name}
                            </Text>
                            {item.isTemplate && (
                                <View style={styles.templateBadge}>
                                    <Text style={styles.templateText}>Template</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.cardMeta}>
                            {item.durationWeeks && (
                                <View style={styles.metaItem}>
                                    <Ionicons name="calendar-outline" size={14} color="#fff" />
                                    <Text style={styles.metaText}>{item.durationWeeks} weeks</Text>
                                </View>
                            )}
                            {item.daysPerWeek && (
                                <View style={styles.metaItem}>
                                    <Ionicons name="barbell-outline" size={14} color="#fff" />
                                    <Text style={styles.metaText}>{item.daysPerWeek} days/wk</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => handleAssignProgram(item.id)}
                            >
                                <Ionicons name="person-add-outline" size={16} color="#fff" />
                                <Text style={styles.actionText}>Assign</Text>
                            </TouchableOpacity>

                            <View style={styles.assignCount}>
                                <Text style={styles.countText}>
                                    {item.timesAssigned} assigned
                                </Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    // Empty state
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Programs Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Create your first program to start training athletes
            </Text>
            <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateProgram}
            >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>Create Program</Text>
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>My Programs</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {programs.length} program{programs.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {/* Program List */}
            <FlatList
                data={programs}
                renderItem={renderProgramCard}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                numColumns={2}
                columnWrapperStyle={styles.row}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[colors.primary]}
                    />
                }
            />

            {/* FAB */}
            {programs.length > 0 && (
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: colors.primary }]}
                    onPress={handleCreateProgram}
                >
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            )}
        </View>
    );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    listContent: {
        padding: 12,
    },
    row: {
        justifyContent: 'space-between',
    },
    programCard: {
        width: '48%',
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    cardGradient: {
        padding: 16,
        minHeight: 160,
    },
    cardContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    programName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
        marginRight: 8,
    },
    templateBadge: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    templateText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '500',
    },
    cardMeta: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    actionText: {
        fontSize: 12,
        color: '#fff',
        fontWeight: '500',
    },
    assignCount: {
        opacity: 0.7,
    },
    countText: {
        fontSize: 11,
        color: '#fff',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 24,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
});
