/**
 * Browse Screen
 * 
 * Displays all 2,598 workout programs with selection UI.
 * Uses virtualized list for performance.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgramCard } from '@/components/program/program-card';
import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { DifficultyLevel, ProgramDisplayItem, ProgramType } from '@/lib/domain/program';
import { programsService } from '@/lib/services/programs/programs-service';

// ============================================
// CONSTANTS
// ============================================

const PAGE_SIZE = 50; // Load 50 at a time for performance

const FILTER_OPTIONS = {
  type: ['All', 'STRENGTH', 'HYPERTROPHY', 'FULL_BODY', 'BODYWEIGHT', 'ATHLETIC', 'POWERLIFTING'],
  difficulty: ['All', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
};

// ============================================
// SCREEN COMPONENT
// ============================================

export default function BrowseScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaging, setIsPaging] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [displayedPrograms, setDisplayedPrograms] = useState<ProgramDisplayItem[]>([]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const filters = useMemo(() => {
    const f: { type?: ProgramType; difficulty?: DifficultyLevel } = {};
    if (typeFilter !== 'All') f.type = typeFilter as ProgramType;
    if (difficultyFilter !== 'All') f.difficulty = difficultyFilter as DifficultyLevel;
    return f;
  }, [typeFilter, difficultyFilter]);

  const loadPage = useCallback(
    async (opts?: { reset?: boolean }) => {
      const reset = opts?.reset ?? false;
      const offset = reset ? 0 : displayedPrograms.length;

      if (reset) setIsLoading(true);
      else setIsPaging(true);

      try {
        const res = await programsService.listCatalog({
          q: searchQuery,
          filters,
          limit: PAGE_SIZE,
          offset,
        });

        setCatalogTotal(programsService.getTotalCount());
        setFilteredTotal(res.total);
        setDisplayedPrograms((prev) => (reset ? res.items : [...prev, ...res.items]));
      } finally {
        setIsLoading(false);
        setIsPaging(false);
      }
    },
    [displayedPrograms.length, filters, searchQuery]
  );

  // Initial load + reload on filter/search changes
  useEffect(() => {
    loadPage({ reset: true });
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (isLoading || isPaging) return;
    if (displayedPrograms.length >= filteredTotal) return;
    loadPage({ reset: false });
  }, [displayedPrograms.length, filteredTotal, isLoading, isPaging, loadPage]);

  // Toggle selection
  const toggleSelect = useCallback((program: ProgramDisplayItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(program.id)) {
        next.delete(program.id);
      } else {
        next.add(program.id);
      }
      return next;
    });
  }, []);

  // Clear selection
  const clearSelection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(new Set());
  };

  // Add selected programs to My Programs
  const handleAddSelected = async () => {
    if (selectedIds.size === 0) return;

    setIsAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const addedCount = await programsService.installProgramsByCatalogIds(Array.from(selectedIds));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedIds(new Set());

      const message = `Added ${addedCount} program${addedCount !== 1 ? 's' : ''} to My Programs!`;

      if (Platform.OS === 'web') {
        if (window.confirm(`${message} Go there now?`)) {
          router.push('/(tabs)');
        }
      } else {
        Alert.alert('Success!', message, [
          { text: 'View Programs', onPress: () => router.push('/(tabs)') },
          { text: 'OK', style: 'cancel' },
        ]);
      }
    } catch (e) {
      console.error(e);
      const msg = 'Failed to add programs';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsAdding(false);
    }
  };

  // Render a program card
  const renderItem = useCallback(({ item }: { item: ProgramDisplayItem }) => (
    <View style={styles.cardWrapper}>
      <ProgramCard
        program={item}
        isSelected={selectedIds.has(item.id)}
        onToggleSelect={toggleSelect}
      />
    </View>
  ), [selectedIds, toggleSelect]);

  // Render footer (progress indicator)
  const renderFooter = () => {
    const remaining = filteredTotal - displayedPrograms.length;
    if (remaining <= 0) return null;
    return (
      <View style={styles.footerInfo}>
        {isPaging ? <ActivityIndicator size="small" color={colors.tint} /> : null}
        <ThemedText style={[styles.footerInfoText, { color: colors.textSecondary }]}>
          {isPaging ? `Loading more… (${remaining} remaining)` : `${remaining} remaining`}
        </ThemedText>
      </View>
    );
  };

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const totalCount = catalogTotal;

  return (
    <SwipeTabs current="browse">
      <Screen contentStyle={styles.screenContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
              Browse Programs
            </ThemedText>
            <ThemedText style={[styles.headerCount, { color: colors.textSecondary }]}>
              {totalCount.toLocaleString()} available
            </ThemedText>
          </View>
          
          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search programs..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <Pressable onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            {/* Type Filter */}
            <View style={styles.filterGroup}>
              <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>Type:</ThemedText>
              <FlatList
                horizontal
                data={FILTER_OPTIONS.type}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: typeFilter === item ? colors.tint : colors.card,
                        borderColor: typeFilter === item ? colors.tint : colors.separator,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTypeFilter(item);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.filterChipText,
                        { color: typeFilter === item ? '#fff' : colors.text },
                      ]}
                    >
                      {item === 'All' ? 'All' : item.replace(/_/g, ' ')}
                    </ThemedText>
                  </Pressable>
                )}
                keyExtractor={(item) => item}
              />
            </View>

            {/* Difficulty Filter */}
            <View style={styles.filterGroup}>
              <ThemedText style={[styles.filterLabel, { color: colors.textSecondary }]}>Level:</ThemedText>
              <FlatList
                horizontal
                data={FILTER_OPTIONS.difficulty}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: difficultyFilter === item ? colors.tint : colors.card,
                        borderColor: difficultyFilter === item ? colors.tint : colors.separator,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setDifficultyFilter(item);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.filterChipText,
                        { color: difficultyFilter === item ? '#fff' : colors.text },
                      ]}
                    >
                      {item === 'All' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()}
                    </ThemedText>
                  </Pressable>
                )}
                keyExtractor={(item) => item}
              />
            </View>
          </View>

          {/* Results count and selection */}
          <View style={styles.resultsRow}>
            <ThemedText style={[styles.resultsText, { color: colors.textSecondary }]}>
              {filteredTotal.toLocaleString()} results
            </ThemedText>
            {hasSelection && (
              <Pressable style={styles.clearSelection} onPress={clearSelection}>
                <ThemedText style={[styles.clearSelectionText, { color: colors.tint }]}>
                  Clear ({selectedCount})
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        {/* Program List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading {totalCount.toLocaleString()} programs...
            </ThemedText>
          </View>
        ) : filteredTotal === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.tintMuted }]}>
              <IconSymbol name="magnifyingglass" size={32} color={colors.tint} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No programs found
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Try adjusting your filters
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={displayedPrograms}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: hasSelection ? 100 : 120 }]}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={renderFooter}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={true}
            onEndReached={loadMore}
            onEndReachedThreshold={0.7}
            getItemLayout={(data, index) => ({
              length: 120, // Approximate item height
              offset: 120 * index,
              index,
            })}
          />
        )}

        {/* Floating Add Button */}
        {hasSelection && (
          <View style={[styles.floatingBar, { paddingBottom: insets.bottom + 10 }]}>
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.tint, opacity: pressed || isAdding ? 0.8 : 1 },
              ]}
              onPress={handleAddSelected}
              disabled={isAdding}
            >
              <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
              <ThemedText style={styles.addButtonText}>
                {isAdding ? 'Adding...' : `Add ${selectedCount} to My Programs`}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </Screen>
    </SwipeTabs>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...Typography.title2,
  },
  headerCount: {
    ...Typography.footnote,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  filterRow: {
    gap: Spacing.xs,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    ...Typography.caption1,
    fontWeight: '600',
    width: 40,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 6,
  },
  filterChipText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  resultsText: {
    ...Typography.footnote,
  },
  clearSelection: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearSelectionText: {
    ...Typography.footnote,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  cardWrapper: {
    marginBottom: Spacing.sm,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: Spacing.md,
  },
  footerInfoText: {
    ...Typography.footnote,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.title3,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    ...Shadows.md,
  },
  addButtonText: {
    ...Typography.headline,
    color: '#fff',
  },
});
