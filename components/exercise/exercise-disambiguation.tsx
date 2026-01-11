/**
 * Exercise Disambiguation Dropdown
 * 
 * Shows the best match as selected, with a dropdown of alternatives
 * and an option to create a custom exercise if none match.
 */

import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface ExerciseOption {
    name: string;
    confidence: 'exact' | 'high' | 'medium' | 'low';
    score: number;
}

interface ExerciseDisambiguationProps {
    /** The raw name from voice/input */
    rawName: string;
    /** The currently selected exercise name */
    selectedName: string;
    /** Alternative options (up to 4) */
    alternatives: ExerciseOption[];
    /** Called when user selects an option */
    onSelect: (name: string) => void;
    /** Called when user creates a custom exercise */
    onCreateCustom: (name: string) => void;
}

export function ExerciseDisambiguationDropdown({
    rawName,
    selectedName,
    alternatives,
    onSelect,
    onCreateCustom,
}: ExerciseDisambiguationProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [isOpen, setIsOpen] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customName, setCustomName] = useState(rawName);

    const handleToggle = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsOpen(!isOpen);
    }, [isOpen]);

    const handleSelectOption = useCallback((name: string) => {
        Haptics.selectionAsync();
        onSelect(name);
        setIsOpen(false);
    }, [onSelect]);

    const handleCreateCustom = useCallback(() => {
        if (customName.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onCreateCustom(customName.trim());
            setShowCustomInput(false);
            setIsOpen(false);
        }
    }, [customName, onCreateCustom]);

    const getConfidenceColor = (confidence: ExerciseOption['confidence']) => {
        switch (confidence) {
            case 'exact': return '#30D158'; // Green
            case 'high': return '#32ADE6';  // Blue
            case 'medium': return '#FF9F0A'; // Orange
            case 'low': return '#FF453A';    // Red
        }
    };

    const getConfidenceLabel = (confidence: ExerciseOption['confidence']) => {
        switch (confidence) {
            case 'exact': return '✓ Exact';
            case 'high': return '● High';
            case 'medium': return '○ Fair';
            case 'low': return '? Low';
        }
    };

    return (
        <View style={styles.container}>
            {/* Selected Exercise with Dropdown Trigger */}
            <Pressable
                style={[
                    styles.selectedContainer,
                    { backgroundColor: colors.groupedBackground, borderColor: colors.separator },
                ]}
                onPress={handleToggle}
            >
                <View style={styles.selectedContent}>
                    <ThemedText style={styles.selectedName} numberOfLines={1}>
                        {selectedName}
                    </ThemedText>
                    {rawName.toLowerCase() !== selectedName.toLowerCase() && (
                        <ThemedText style={[styles.rawName, { color: colors.textSecondary }]} numberOfLines={1}>
                            from "{rawName}"
                        </ThemedText>
                    )}
                </View>
                <IconSymbol
                    name={isOpen ? 'chevron.up' : 'chevron.down'}
                    size={16}
                    color={colors.textSecondary}
                />
            </Pressable>

            {/* Dropdown Options */}
            {isOpen && (
                <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                    <ScrollView style={styles.optionsList} nestedScrollEnabled>
                        {/* Current selection (highlighted) */}
                        <Pressable
                            style={[styles.optionItem, styles.optionSelected, { backgroundColor: colors.tint + '15' }]}
                            onPress={() => handleSelectOption(selectedName)}
                        >
                            <IconSymbol name="checkmark" size={16} color={colors.tint} />
                            <ThemedText style={[styles.optionName, { color: colors.tint }]} numberOfLines={1}>
                                {selectedName}
                            </ThemedText>
                        </Pressable>

                        {/* Alternative options */}
                        {alternatives
                            .filter(alt => alt.name !== selectedName)
                            .slice(0, 4)
                            .map((option, index) => (
                                <Pressable
                                    key={`${option.name}-${index}`}
                                    style={[styles.optionItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}
                                    onPress={() => handleSelectOption(option.name)}
                                >
                                    <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(option.confidence) + '20' }]}>
                                        <ThemedText style={[styles.confidenceText, { color: getConfidenceColor(option.confidence) }]}>
                                            {getConfidenceLabel(option.confidence)}
                                        </ThemedText>
                                    </View>
                                    <ThemedText style={styles.optionName} numberOfLines={1}>
                                        {option.name}
                                    </ThemedText>
                                </Pressable>
                            ))}

                        {/* Divider */}
                        <View style={[styles.divider, { backgroundColor: colors.separator }]} />

                        {/* Create Custom Option */}
                        {!showCustomInput ? (
                            <Pressable
                                style={styles.optionItem}
                                onPress={() => setShowCustomInput(true)}
                            >
                                <IconSymbol name="plus.circle" size={18} color={colors.tint} />
                                <ThemedText style={[styles.optionName, { color: colors.tint }]}>
                                    Create "{rawName}" as new exercise
                                </ThemedText>
                            </Pressable>
                        ) : (
                            <View style={styles.customInputContainer}>
                                <TextInput
                                    style={[
                                        styles.customInput,
                                        { backgroundColor: colors.groupedBackground, color: colors.text, borderColor: colors.separator },
                                    ]}
                                    value={customName}
                                    onChangeText={setCustomName}
                                    placeholder="Exercise name..."
                                    placeholderTextColor={colors.textTertiary}
                                    autoFocus
                                    returnKeyType="done"
                                    onSubmitEditing={handleCreateCustom}
                                />
                                <View style={styles.customActions}>
                                    <Pressable
                                        style={[styles.customButton, styles.cancelButton, { borderColor: colors.separator }]}
                                        onPress={() => setShowCustomInput(false)}
                                    >
                                        <ThemedText style={{ color: colors.textSecondary }}>Cancel</ThemedText>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.customButton, styles.createButton, { backgroundColor: colors.tint }]}
                                        onPress={handleCreateCustom}
                                    >
                                        <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Create</ThemedText>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 10,
    },
    selectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
    },
    selectedContent: {
        flex: 1,
        marginRight: Spacing.sm,
    },
    selectedName: {
        ...Typography.body,
        fontWeight: '600',
    },
    rawName: {
        ...Typography.caption2,
        marginTop: 2,
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        maxHeight: 280,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    optionsList: {
        maxHeight: 260,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    optionSelected: {
        paddingVertical: Spacing.md,
    },
    optionName: {
        ...Typography.body,
        flex: 1,
    },
    confidenceBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Radius.sm,
    },
    confidenceText: {
        ...Typography.caption2,
        fontWeight: '600',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginVertical: Spacing.xs,
    },
    customInputContainer: {
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    customInput: {
        ...Typography.body,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
    },
    customActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    customButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
    },
    cancelButton: {
        borderWidth: StyleSheet.hairlineWidth,
    },
    createButton: {},
});
