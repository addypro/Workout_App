/**
 * Coach Classes List
 *
 * Displays class templates with create/schedule actions.
 * Feature-gated behind workout_classes flag.
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
    ClassTemplate,
    getMyClassTemplates,
} from '@/lib/services/classes';

export default function ClassesIndexScreen() {
    const router = useRouter();
    const [templates, setTemplates] = useState<ClassTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    const loadTemplates = async () => {
        const result = await getMyClassTemplates();
        if (result.data) {
            setTemplates(result.data.items);
        }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadTemplates();
    };

    const handleCreateTemplate = () => {
        router.push('/coach/classes/builder');
    };

    const handleTemplatePress = (template: ClassTemplate) => {
        router.push(`/coach/classes/${template.id}`);
    };

    const renderTemplate = ({ item }: { item: ClassTemplate }) => (
        <TouchableOpacity
            style={styles.templateCard}
            onPress={() => handleTemplatePress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.templateHeader}>
                <View style={styles.templateIcon}>
                    <Ionicons name="people" size={24} color={Colors.dark.primary} />
                </View>
                <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{item.name}</Text>
                    {item.description && (
                        <Text style={styles.templateDescription} numberOfLines={1}>
                            {item.description}
                        </Text>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
            </View>
            <View style={styles.templateMeta}>
                <View style={styles.metaItem}>
                    <Ionicons name="barbell-outline" size={14} color={Colors.dark.textSecondary} />
                    <Text style={styles.metaText}>{item.exercisesJson.length} exercises</Text>
                </View>
                <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.dark.textSecondary} />
                    <Text style={styles.metaText}>{item.estimatedDurationMinutes} min</Text>
                </View>
                <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={14} color={Colors.dark.textSecondary} />
                    <Text style={styles.metaText}>{item.defaultCapacity} max</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyTitle}>No Class Templates Yet</Text>
            <Text style={styles.emptySubtitle}>
                Create a template to start scheduling group workout classes
            </Text>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateTemplate}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create Template</Text>
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
                <Text style={styles.headerTitle}>Workout Classes</Text>
                <TouchableOpacity onPress={handleCreateTemplate} style={styles.addButton}>
                    <Ionicons name="add-circle" size={28} color={Colors.dark.primary} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            ) : (
                <FlatList
                    data={templates}
                    renderItem={renderTemplate}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary}
                        />
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
    addButton: {
        padding: 4,
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    templateCard: {
        backgroundColor: Colors.dark.card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    templateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    templateIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    templateInfo: {
        flex: 1,
    },
    templateName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 2,
    },
    templateDescription: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
    },
    templateMeta: {
        flexDirection: 'row',
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
        marginBottom: 24,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 8,
    },
    createButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
});
