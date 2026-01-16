/**
 * Exercise Picker Screen
 * Full-screen modal for selecting exercises from the database
 * Features:
 * - Hierarchical search with popular exercises at top
 * - Semantic/NLP search for natural language queries
 * - 3-pathway navigation (equipment, movement, muscle)
 */

import { CreateCustomModal } from '@/components/exercise/create-custom-modal';
import { ExerciseCard } from '@/components/exercise/exercise-card';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useExerciseDbMapping } from '@/lib/hooks/use-exercisedb-mapping';
import {
  BODY_REGIONS,
  EQUIPMENT_CATEGORIES,
  type ExerciseDatabaseEntry,
} from '@/lib/services/exercise/database';
import {
  getPopularExercises,
  searchExercisesEnhanced,
  type EnhancedSearchResults,
  type SearchResult,
  type TaxonomyExercise,
} from '@/lib/services/exercise/search';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SELECTED_EXERCISE_KEY = '@selected_exercise_temp';

type FilterType = 'bodyRegion' | 'equipment' | null;

export default function ExercisePickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Get workout index from params (if adding to a specific workout)
  const workoutIndex = params.workoutIndex ? parseInt(params.workoutIndex as string) : undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>(null);
  const [selectedBodyRegion, setSelectedBodyRegion] = useState<string | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<EnhancedSearchResults | null>(null);
  const [popularExercises, setPopularExercises] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<string | null>(null); // Track which exercise shows suggestions
  const [showCreateCustom, setShowCreateCustom] = useState(false); // Custom exercise creation modal

  // ExerciseDB Media Hook - provides GIF URLs and instructions
  const { getMedia } = useExerciseDbMapping();

  // Refs for tracking state without causing re-renders
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Initial load - only runs once, guarded by ref
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    getPopularExercises(30)
      .then(popular => {
        if (mountedRef.current) {
          setPopularExercises(popular);
          setLoading(false);
        }
      })
      .catch(error => {
        console.error('Error loading exercises:', error);
        if (mountedRef.current) {
          setLoading(false);
        }
      });
  }, []);

  // Direct search function - NO useCallback, NO useEffect dependency
  // Called directly from event handlers
  const triggerSearch = (query: string, bodyRegion: string | null, equipment: string | null) => {
    // Clear any pending search
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    // If no filters active, clear results
    if (query.trim() === '' && bodyRegion === null && equipment === null) {
      setSearchResults(null);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      setLoading(true);
      try {
        // Use the enhanced search with taxonomy intelligence
        const results = await searchExercisesEnhanced(query, {
          bodyRegion: bodyRegion || undefined,
          equipment: equipment || undefined,
        });
        if (mountedRef.current) {
          setSearchResults(results);
          setLoading(false);
        }
      } catch (error) {
        console.error('Search error:', error);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, 100); // Reduced from 350ms for faster response
  };

  // Custom search query handler - triggers search directly
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    triggerSearch(text, selectedBodyRegion, selectedEquipment);
  };

  const toggleBodyRegion = (regionId: string) => {
    Haptics.selectionAsync();
    const newValue = selectedBodyRegion === regionId ? null : regionId;
    setSelectedBodyRegion(newValue);
    setActiveFilter('bodyRegion');
    triggerSearch(searchQuery, newValue, selectedEquipment);
  };

  const toggleEquipment = (equipmentId: string) => {
    Haptics.selectionAsync();
    const newValue = selectedEquipment === equipmentId ? null : equipmentId;
    setSelectedEquipment(newValue);
    setActiveFilter('equipment');
    triggerSearch(searchQuery, selectedBodyRegion, newValue);
  };

  const clearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSearchQuery('');
    setSelectedBodyRegion(null);
    setSelectedEquipment(null);
    setActiveFilter(null);
    setSearchResults(null);
    // Clear any pending search
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  };

  const handleSelectExercise = async (exercise: SearchResult | ExerciseDatabaseEntry | TaxonomyExercise) => {
    try {
      // Normalize exercise data (taxonomy exercises have different structure)
      const exerciseData = 'canonical_name' in exercise
        ? {
          name: exercise.canonical_name,
          muscles: exercise.muscles?.primary || [],
          equipment: exercise.constraints?.equipment || [],
          difficulty: exercise.constraints?.difficulty || 'intermediate',
        }
        : {
          name: exercise.name,
          muscles: exercise.muscles,
          equipment: exercise.equipment,
          difficulty: exercise.difficulty,
        };

      // Store selected exercise temporarily
      await AsyncStorage.setItem(SELECTED_EXERCISE_KEY, JSON.stringify({
        ...exerciseData,
        workoutIndex,
      }));

      // Small delay to ensure storage is fully committed before navigation
      await new Promise(resolve => setTimeout(resolve, 50));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate back (the previous screen will pick up the selection via focus effect)
      router.back();
    } catch (error) {
      console.error('Error selecting exercise:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Handle custom exercise creation
  const handleCustomExerciseCreated = async (exercise: { id: string; name: string }) => {
    try {
      // Store selected exercise temporarily
      await AsyncStorage.setItem(SELECTED_EXERCISE_KEY, JSON.stringify({
        name: exercise.name,
        muscles: [],
        equipment: [],
        difficulty: 'intermediate',
        isCustom: true,
        customExerciseId: exercise.id,
        workoutIndex,
      }));

      // Small delay to ensure storage is fully committed before navigation
      await new Promise(resolve => setTimeout(resolve, 50));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Error selecting custom exercise:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const toggleSuggestions = (id: string) => {
    Haptics.selectionAsync();
    setShowSuggestions(showSuggestions === id ? null : id);
  };

  const toggleExpand = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedId(expandedId === id ? null : id);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedBodyRegion !== null || selectedEquipment !== null;
  const hasFilterOnly = selectedBodyRegion !== null || selectedEquipment !== null;
  const hasSearchOnly = searchQuery.trim() !== '' && !hasFilterOnly;

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderEquipmentFilters = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.quickFilters}
      contentContainerStyle={styles.quickFiltersContent}
    >
      {Object.values(EQUIPMENT_CATEGORIES).slice(0, 6).map(cat => {
        const isActive = selectedEquipment === cat.id;
        return (
          <Pressable
            key={cat.id}
            style={[
              styles.quickFilterChip,
              {
                backgroundColor: isActive ? cat.color + '20' : colors.card,
                borderColor: isActive ? cat.color : colors.separator,
              },
            ]}
            onPress={() => toggleEquipment(cat.id)}
          >
            <IconSymbol name={cat.icon as any} size={16} color={isActive ? cat.color : colors.textSecondary} />
            <ThemedText style={[styles.quickFilterText, { color: isActive ? cat.color : colors.text }]}>
              {cat.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderBodyRegionFilters = () => (
    <View style={styles.bodyRegionRow}>
      {Object.values(BODY_REGIONS).map(region => {
        const isActive = selectedBodyRegion === region.id;
        return (
          <Pressable
            key={region.id}
            style={[
              styles.bodyRegionChip,
              {
                backgroundColor: isActive ? region.color + '20' : colors.card,
                borderColor: isActive ? region.color : colors.separator,
              },
            ]}
            onPress={() => toggleBodyRegion(region.id)}
          >
            <IconSymbol name={region.icon as any} size={18} color={isActive ? region.color : colors.textSecondary} />
            <ThemedText style={[styles.bodyRegionText, { color: isActive ? region.color : colors.text }]}>
              {region.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  // Add db- prefix to key to avoid duplicate key conflicts with taxonomy results
  const renderExerciseCard = (exercise: SearchResult, showScore = false, keyPrefix = '') => {
    // Get ExerciseDB media (GIF + instructions) for this exercise
    const media = getMedia(exercise.name);

    return (
      <View key={`${keyPrefix}${exercise.id}`} style={{ marginBottom: Spacing.sm }}>
        <ExerciseCard
          exercise={exercise}
          expanded={expandedId === exercise.id}
          onPress={() => toggleExpand(exercise.id)}
          onSelect={handleSelectExercise}
          showSelectButton={expandedId !== exercise.id}
          gifUrl={media?.gifUrl}
          instructions={media?.instructions}
        />
        {showScore && exercise.matchReason && (
          <View style={[styles.matchReason, { backgroundColor: colors.tintMuted }]}>
            <ThemedText style={[styles.matchReasonText, { color: colors.tint }]}>
              {exercise.matchReason}
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  // Render taxonomy exercise with smart suggestions
  const renderTaxonomyExercise = (result: EnhancedSearchResults['taxonomyMatches'][0]) => {
    const { taxonomyExercise, matchType, suggestions } = result;
    const hasSuggestions = suggestions && (suggestions.progression || suggestions.regression || suggestions.siblings.length > 0);
    const isShowingSuggestions = showSuggestions === taxonomyExercise.id;

    return (
      <View key={taxonomyExercise.id} style={{ marginBottom: Spacing.sm }}>
        {/* Main Exercise Card */}
        <Pressable
          style={[
            styles.taxonomyCard,
            { backgroundColor: colors.card, borderColor: colors.separator },
          ]}
          onPress={() => handleSelectExercise(taxonomyExercise)}
        >
          <View style={styles.taxonomyCardContent}>
            <View style={styles.taxonomyHeader}>
              <ThemedText style={[styles.taxonomyName, { color: colors.text }]}>
                {taxonomyExercise.canonical_name}
              </ThemedText>
              {matchType !== 'exact' && (
                <View style={[styles.matchTypeBadge, { backgroundColor: colors.tint + '15' }]}>
                  <ThemedText style={[styles.matchTypeText, { color: colors.tint }]}>
                    {matchType}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Muscles & Equipment */}
            <View style={styles.taxonomyMeta}>
              {taxonomyExercise.muscles?.primary && (
                <ThemedText style={[styles.taxonomyMetaText, { color: colors.textSecondary }]}>
                  {taxonomyExercise.muscles.primary.slice(0, 2).join(', ')}
                </ThemedText>
              )}
              {taxonomyExercise.constraints?.difficulty && (
                <View style={[styles.difficultyBadge, {
                  backgroundColor: getDifficultyColor(taxonomyExercise.constraints.difficulty) + '20'
                }]}>
                  <ThemedText style={[styles.difficultyText, {
                    color: getDifficultyColor(taxonomyExercise.constraints.difficulty)
                  }]}>
                    {taxonomyExercise.constraints.difficulty}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Smart Suggestions Toggle */}
            {hasSuggestions && (
              <Pressable
                style={[styles.suggestionsToggle, { backgroundColor: colors.tintMuted }]}
                onPress={() => toggleSuggestions(taxonomyExercise.id)}
                hitSlop={8}
              >
                <IconSymbol
                  name={isShowingSuggestions ? 'chevron.up' : 'chevron.down'}
                  size={12}
                  color={colors.tint}
                />
                <ThemedText style={[styles.suggestionsToggleText, { color: colors.tint }]}>
                  {isShowingSuggestions ? 'Hide' : 'Show'} Alternatives
                </ThemedText>
              </Pressable>
            )}
          </View>

          {/* Select Button */}
          <Pressable
            style={[styles.selectButton, { backgroundColor: colors.tint }]}
            onPress={() => handleSelectExercise(taxonomyExercise)}
          >
            <IconSymbol name="plus" size={16} color="#fff" />
          </Pressable>
        </Pressable>

        {/* Smart Suggestions Panel */}
        {isShowingSuggestions && suggestions && (
          <View style={[styles.suggestionsPanel, { backgroundColor: colors.groupedBackground, borderColor: colors.separator }]}>
            {suggestions.progression && (
              <View style={styles.suggestionRow}>
                <View style={[styles.suggestionLabel, { backgroundColor: '#34C75920' }]}>
                  <IconSymbol name="arrow.up" size={10} color="#34C759" />
                  <ThemedText style={[styles.suggestionLabelText, { color: '#34C759' }]}>
                    Harder
                  </ThemedText>
                </View>
                <Pressable
                  style={styles.suggestionItem}
                  onPress={() => handleSelectExercise(suggestions.progression!)}
                >
                  <ThemedText style={[styles.suggestionName, { color: colors.text }]}>
                    {suggestions.progression.canonical_name}
                  </ThemedText>
                  <IconSymbol name="plus.circle" size={18} color={colors.tint} />
                </Pressable>
              </View>
            )}

            {suggestions.regression && (
              <View style={styles.suggestionRow}>
                <View style={[styles.suggestionLabel, { backgroundColor: '#FF950020' }]}>
                  <IconSymbol name="arrow.down" size={10} color="#FF9500" />
                  <ThemedText style={[styles.suggestionLabelText, { color: '#FF9500' }]}>
                    Easier
                  </ThemedText>
                </View>
                <Pressable
                  style={styles.suggestionItem}
                  onPress={() => handleSelectExercise(suggestions.regression!)}
                >
                  <ThemedText style={[styles.suggestionName, { color: colors.text }]}>
                    {suggestions.regression.canonical_name}
                  </ThemedText>
                  <IconSymbol name="plus.circle" size={18} color={colors.tint} />
                </Pressable>
              </View>
            )}

            {suggestions.siblings.length > 0 && (
              <View style={styles.siblingsSection}>
                <ThemedText style={[styles.siblingsLabel, { color: colors.textTertiary }]}>
                  Similar exercises:
                </ThemedText>
                <View style={styles.siblingsList}>
                  {suggestions.siblings.slice(0, 3).map(sibling => (
                    <Pressable
                      key={sibling.id}
                      style={[styles.siblingChip, { backgroundColor: colors.card, borderColor: colors.separator }]}
                      onPress={() => handleSelectExercise(sibling)}
                    >
                      <ThemedText style={[styles.siblingText, { color: colors.text }]}>
                        {sibling.canonical_name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // Helper to get difficulty color
  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return '#34C759';
      case 'intermediate': return '#FF9500';
      case 'advanced': return '#FF3B30';
      case 'expert': return '#AF52DE';
      default: return colors.textSecondary;
    }
  };

  // Render slang interpretation banner
  const renderSlangBanner = () => {
    if (!searchResults?.slangInterpretation) return null;

    return (
      <View style={[styles.slangBanner, { backgroundColor: colors.tint + '10', borderColor: colors.tint + '30' }]}>
        <View style={styles.slangHeader}>
          <IconSymbol name="sparkles" size={14} color={colors.tint} />
          <ThemedText style={[styles.slangText, { color: colors.tint }]}>
            "{searchResults.slangInterpretation.term}" = {searchResults.slangInterpretation.intent}
          </ThemedText>
        </View>
        {searchResults.slangInterpretation.suggestedPatterns.length > 0 && (
          <ThemedText style={[styles.slangPatterns, { color: colors.textSecondary }]}>
            Showing: {searchResults.slangInterpretation.suggestedPatterns.join(', ')}
          </ThemedText>
        )}
      </View>
    );
  };

  // Render taxonomy matches section (only for search-only, no filter)
  const renderTaxonomySection = () => {
    if (!searchResults?.taxonomyMatches?.length) return null;
    // Only show "Best Matches" when searching without body/equipment filters
    if (hasFilterOnly) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.tint + '15' }]}>
            <IconSymbol name="star.fill" size={14} color={colors.tint} />
          </View>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Best Matches
          </ThemedText>
          <View style={[styles.sectionCount, { backgroundColor: colors.tintMuted }]}>
            <ThemedText style={[styles.sectionCountText, { color: colors.tint }]}>
              {searchResults.taxonomyMatches.length}
            </ThemedText>
          </View>
        </View>
        {/* Limit to 30 for performance - search already caps at ~30 */}
        {searchResults.taxonomyMatches.slice(0, 30).map(result => renderTaxonomyExercise(result))}
      </View>
    );
  };

  // Render filtered results section (when body region or equipment filter is active)
  const renderFilteredResultsSection = () => {
    if (!hasFilterOnly) return null;

    // Combine taxonomy and database matches for filtered view
    const allResults = [
      ...(searchResults?.taxonomyMatches || []),
    ];
    // Deduplicate database results by ID to prevent React key conflicts
    const seenIds = new Set<string>();
    const databaseResults = (searchResults?.databaseMatches || []).filter(ex => {
      if (seenIds.has(ex.id)) return false;
      seenIds.add(ex.id);
      return true;
    });

    if (allResults.length === 0 && databaseResults.length === 0) return null;

    const filterName = selectedBodyRegion
      ? BODY_REGIONS[selectedBodyRegion as keyof typeof BODY_REGIONS]?.name
      : selectedEquipment
        ? EQUIPMENT_CATEGORIES[selectedEquipment as keyof typeof EQUIPMENT_CATEGORIES]?.name
        : 'Filtered';

    const filterColor = selectedBodyRegion
      ? BODY_REGIONS[selectedBodyRegion as keyof typeof BODY_REGIONS]?.color
      : selectedEquipment
        ? EQUIPMENT_CATEGORIES[selectedEquipment as keyof typeof EQUIPMENT_CATEGORIES]?.color
        : colors.tint;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: filterColor + '20' }]}>
            <IconSymbol name="line.3.horizontal.decrease" size={14} color={filterColor} />
          </View>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {filterName} Exercises
          </ThemedText>
          <View style={[styles.sectionCount, { backgroundColor: filterColor + '15' }]}>
            <ThemedText style={[styles.sectionCountText, { color: filterColor }]}>
              {allResults.length + databaseResults.length}
            </ThemedText>
          </View>
        </View>
        {/* Limit to 30 for performance */}
        {allResults.slice(0, 30).map(result => renderTaxonomyExercise(result))}
        {databaseResults.slice(0, 15).map((ex, idx) => renderExerciseCard(ex, false, `db-${idx}-`))}
        {databaseResults.length > 15 && (
          <ThemedText style={[styles.moreText, { color: colors.textTertiary }]}>
            +{databaseResults.length - 15} more exercises
          </ThemedText>
        )}
      </View>
    );
  };

  // Render "Other Results" section when searching with a filter but matches exist outside filter
  const renderOtherResultsSection = () => {
    // Only show when both search and filter are active, and we have few or no filtered results
    if (!hasFilterOnly || !searchQuery.trim()) return null;

    const filteredCount = (searchResults?.taxonomyMatches?.length || 0) + (searchResults?.databaseMatches?.length || 0);

    // If we have enough filtered results, don't show this section
    if (filteredCount >= 5) return null;

    // This would require a separate search without filters - for now, show a hint
    return (
      <View style={[styles.section, { marginTop: Spacing.md }]}>
        <View style={[styles.otherResultsHint, { backgroundColor: colors.tintMuted, borderColor: colors.separator }]}>
          <IconSymbol name="sparkles" size={16} color={colors.tint} />
          <ThemedText style={[styles.otherResultsText, { color: colors.textSecondary }]}>
            Try removing the filter to see more "{searchQuery}" results
          </ThemedText>
        </View>
      </View>
    );
  };

  // Render pattern recommendations
  const renderPatternRecommendations = () => {
    if (!searchResults?.patternRecommendations?.length) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#AF52DE20' }]}>
            <IconSymbol name="rectangle.3.group" size={14} color="#AF52DE" />
          </View>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            Movement Patterns
          </ThemedText>
        </View>
        {searchResults.patternRecommendations.map(pattern => (
          <View key={pattern.pattern_id} style={styles.patternCard}>
            <ThemedText style={[styles.patternName, { color: colors.text }]}>
              {pattern.canonical_name}
            </ThemedText>
            <ThemedText style={[styles.patternDescription, { color: colors.textSecondary }]}>
              {pattern.description}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patternExercises}>
              {pattern.exercises.map(ex => (
                <Pressable
                  key={ex.id}
                  style={[styles.patternExerciseChip, { backgroundColor: colors.card, borderColor: colors.separator }]}
                  onPress={() => handleSelectExercise(ex)}
                >
                  <ThemedText style={[styles.patternExerciseText, { color: colors.text }]}>
                    {ex.canonical_name}
                  </ThemedText>
                  <IconSymbol name="plus.circle" size={14} color={colors.tint} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
      </View>
    );
  };

  // Render additional database matches
  const renderDatabaseSection = () => {
    if (!searchResults?.databaseMatches?.length) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#FF950020' }]}>
            <IconSymbol name="square.grid.2x2" size={14} color="#FF9500" />
          </View>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            More Exercises
          </ThemedText>
          <View style={[styles.sectionCount, { backgroundColor: '#FF950015' }]}>
            <ThemedText style={[styles.sectionCountText, { color: '#FF9500' }]}>
              {searchResults.databaseMatches.length}
            </ThemedText>
          </View>
        </View>
        {searchResults.databaseMatches.slice(0, 10).map((ex, idx) => renderExerciseCard(ex, false, `more-${idx}-`))}
        {searchResults.databaseMatches.length > 10 && (
          <ThemedText style={[styles.moreText, { color: colors.textTertiary }]}>
            +{searchResults.databaseMatches.length - 10} more exercises
          </ThemedText>
        )}
      </View>
    );
  };

  const renderPopularSection = () => {
    if (!searchResults?.taxonomyMatches?.length && !searchResults?.databaseMatches?.length) return null;
    // This section is now replaced by renderTaxonomySection and renderDatabaseSection
    return null;
  };

  const renderDefaultPopular = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: '#FFD60A20' }]}>
          <IconSymbol name="flame.fill" size={14} color="#FFD60A" />
        </View>
        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          Popular Exercises
        </ThemedText>
      </View>
      <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Most commonly used exercises
      </ThemedText>
      {/* Limit to 30 for performance - API already caps at 30 */}
      {popularExercises.slice(0, 30).map((ex, idx) => renderExerciseCard(ex, false, `pop-${idx}-`))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.groupedBackground }]}>
      <Stack.Screen
        options={{
          title: 'Select Exercise',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.groupedBackground },
          // Use card presentation instead of modal to avoid iOS remount issues
          presentation: 'card',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ThemedText style={{ color: colors.tint, ...Typography.body }}>Cancel</ThemedText>
            </Pressable>
          ),
          headerRight: hasActiveFilters ? () => (
            <Pressable onPress={clearFilters} hitSlop={12}>
              <ThemedText style={{ color: colors.tint, ...Typography.footnote }}>Clear</ThemedText>
            </Pressable>
          ) : undefined,
        }}
      />

      {/* Search Bar with Create Button */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery !== '' && (
              <Pressable onPress={() => handleSearchChange('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          {/* Create New Exercise Button */}
          <Pressable
            style={({ pressed }) => [
              styles.createExerciseButton,
              {
                backgroundColor: pressed ? colors.tint : colors.tint + '15',
                borderColor: colors.tint,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCreateCustom(true);
            }}
          >
            <IconSymbol name="plus" size={16} color={colors.tint} />
            <ThemedText style={[styles.createExerciseText, { color: colors.tint }]}>
              Create
            </ThemedText>
          </Pressable>
        </View>
        {/* Semantic Intent Badge */}
        {searchResults?.slangInterpretation?.intent && searchResults.slangInterpretation.intent !== 'general' && (
          <View style={[styles.intentBadge, { backgroundColor: colors.tint + '15' }]}>
            <IconSymbol name="sparkles" size={12} color={colors.tint} />
            <ThemedText style={[styles.intentText, { color: colors.tint }]}>
              {searchResults.slangInterpretation.intent}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Equipment Filters */}
      {renderEquipmentFilters()}

      {/* Body Region Filter */}
      <View style={styles.filterSection}>
        {renderBodyRegionFilters()}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : searchResults && searchResults.total === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.tintMuted }]}>
            <IconSymbol name="magnifyingglass" size={32} color={colors.tint} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No exercises found</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Try different keywords, or tap + to create a custom exercise
          </ThemedText>
          {hasActiveFilters && (
            <Pressable
              style={[styles.clearButton, { backgroundColor: colors.tint }]}
              onPress={clearFilters}
            >
              <ThemedText style={styles.clearButtonText}>Clear Filters</ThemedText>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
        >
          {/* Results Header */}
          <ThemedText style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {searchResults?.total.toLocaleString() || popularExercises.length.toLocaleString()} exercises
          </ThemedText>

          {/* Show hierarchical results if searching */}
          {hasActiveFilters && searchResults ? (
            <>
              {renderSlangBanner()}
              {/* Show filtered results when filter is active */}
              {renderFilteredResultsSection()}
              {/* Show "Best Matches" only when searching without filters */}
              {renderTaxonomySection()}
              {renderPatternRecommendations()}
              {/* Only show database section if not showing filtered results */}
              {!hasFilterOnly && renderDatabaseSection()}
              {/* Show hint to remove filter if few results */}
              {renderOtherResultsSection()}
            </>
          ) : (
            /* Show default popular exercises */
            renderDefaultPopular()
          )}
        </ScrollView>
      )}

      {/* Custom Exercise Creation Modal */}
      <CreateCustomModal
        visible={showCreateCustom}
        onClose={() => setShowCreateCustom(false)}
        onCreated={handleCustomExerciseCreated}
        initialName={searchQuery}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  createExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  createExerciseText: {
    ...Typography.footnote,
    fontWeight: '600',
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  intentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  intentText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  quickFilters: {
    maxHeight: 44,
    marginBottom: Spacing.sm,
  },
  quickFiltersContent: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickFilterText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  bodyRegionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bodyRegionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bodyRegionText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.md,
  },
  resultsCount: {
    ...Typography.footnote,
    marginBottom: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...Typography.subhead,
    fontWeight: '600',
    flex: 1,
  },
  sectionSubtitle: {
    ...Typography.footnote,
    marginBottom: Spacing.sm,
    marginTop: -4,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  sectionCountText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  matchReason: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  matchReasonText: {
    ...Typography.caption2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...Typography.title3,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  clearButtonText: {
    color: '#fff',
    ...Typography.subhead,
    fontWeight: '600',
  },
  moreText: {
    ...Typography.footnote,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    fontStyle: 'italic',
  },
  otherResultsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  otherResultsText: {
    ...Typography.footnote,
    flex: 1,
  },
  // Taxonomy card styles
  taxonomyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  taxonomyCardContent: {
    flex: 1,
    gap: 4,
  },
  taxonomyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxonomyName: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  matchTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  matchTypeText: {
    ...Typography.caption2,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  taxonomyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxonomyMetaText: {
    ...Typography.footnote,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  difficultyText: {
    ...Typography.caption2,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  suggestionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  suggestionsToggleText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  selectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  // Suggestions panel
  suggestionsPanel: {
    marginTop: 2,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  suggestionLabelText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  suggestionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionName: {
    ...Typography.footnote,
    flex: 1,
  },
  siblingsSection: {
    marginTop: 4,
  },
  siblingsLabel: {
    ...Typography.caption2,
    marginBottom: 4,
  },
  siblingsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  siblingChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  siblingText: {
    ...Typography.caption1,
  },
  // Slang banner
  slangBanner: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  slangHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slangText: {
    ...Typography.footnote,
    fontWeight: '600',
  },
  slangPatterns: {
    ...Typography.caption2,
    marginTop: 4,
  },
  // Pattern card
  patternCard: {
    marginBottom: Spacing.md,
  },
  patternName: {
    ...Typography.subhead,
    fontWeight: '600',
    marginBottom: 2,
  },
  patternDescription: {
    ...Typography.footnote,
    marginBottom: 8,
  },
  patternExercises: {
    marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  patternExerciseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  patternExerciseText: {
    ...Typography.caption1,
  },
  // Custom Exercise Section styles
  customExerciseSection: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  orText: {
    ...Typography.caption1,
    fontWeight: '500',
  },
  createCustomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    width: '100%',
  },
  createCustomText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  createCustomSubtext: {
    ...Typography.caption2,
    marginTop: 2,
  },
  // Create Custom in results styles
  createCustomSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  createCustomHint: {
    ...Typography.caption1,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  createCustomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  createCustomIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCustomContent: {
    flex: 1,
  },
  createCustomTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  createCustomDescription: {
    ...Typography.caption1,
    marginTop: 2,
  },
});

