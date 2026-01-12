/**
 * Discover Screen (Redesigned)
 *
 * Premium program browse experience with:
 * - Featured programs carousel
 * - Category sections with horizontal scroll
 * - Modern glassmorphism cards
 * - Sticky search + filter header
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ProgramDisplayItem } from '@/lib/domain/program';
import { useSelection } from '@/lib/hooks';
import { getKagglePrograms } from '@/lib/services/programs/kaggle-loader';
import { programsService, type CatalogListItem } from '@/lib/services/programs/programs-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const FEATURED_CARD_WIDTH = SCREEN_WIDTH - 48;

// Category configuration with icons and gradients
const CATEGORY_CONFIG: Record<string, {
  icon: string;
  gradient: [string, string];
  label: string;
  description: string;
}> = {
  'STRENGTH': {
    icon: 'figure.strengthtraining.traditional',
    gradient: ['#FF6B6B', '#EE5A24'],
    label: 'Strength',
    description: 'Build raw power'
  },
  'HYPERTROPHY': {
    icon: 'figure.arms.open',
    gradient: ['#4ECDC4', '#44A08D'],
    label: 'Hypertrophy',
    description: 'Maximize muscle growth'
  },
  'BODYWEIGHT': {
    icon: 'figure.walk',
    gradient: ['#667EEA', '#764BA2'],
    label: 'Bodyweight',
    description: 'No equipment needed'
  },
  'FULL_BODY': {
    icon: 'figure.mixed.cardio',
    gradient: ['#F093FB', '#F5576C'],
    label: 'Full Body',
    description: 'Complete workouts'
  },
  'ATHLETIC': {
    icon: 'figure.run',
    gradient: ['#4776E6', '#8E54E9'],
    label: 'Athletic',
    description: 'Sports performance'
  },
  'POWERLIFTING': {
    icon: 'scalemass.fill',
    gradient: ['#FF8008', '#FFC837'],
    label: 'Powerlifting',
    description: 'Compete & lift heavy'
  },
};

const FILTER_OPTIONS = {
  type: [
    { value: 'All', label: 'All Types' },
    { value: 'STRENGTH', label: 'Strength' },
    { value: 'HYPERTROPHY', label: 'Hypertrophy' },
    { value: 'FULL_BODY', label: 'Full Body' },
    { value: 'BODYWEIGHT', label: 'Bodyweight' },
    { value: 'ATHLETIC', label: 'Athletic' },
    { value: 'POWERLIFTING', label: 'Powerlifting' },
  ],
  difficulty: [
    { value: 'All', label: 'All Levels' },
    { value: 'BEGINNER', label: 'Beginner' },
    { value: 'INTERMEDIATE', label: 'Intermediate' },
    { value: 'ADVANCED', label: 'Advanced' },
  ],
};

const DIFFICULTY_COLORS: Record<string, string> = {
  'BEGINNER': '#4CAF50',
  'INTERMEDIATE': '#FF9800',
  'ADVANCED': '#F44336',
  'ELITE': '#9C27B0',
};

// ============================================
// MEMOIZED PROGRAM CARD (List Stability)
// ============================================
// Custom comparison only checks id and name to prevent
// unnecessary re-renders from function prop changes

interface ProgramCardProps {
  program: CatalogListItem;
  featured?: boolean;
  isSelected: boolean;
  isDark: boolean;
  colors: typeof Colors['light'];
  categoryConfig: { icon: string; gradient: [string, string]; label: string; description: string };
  difficultyColor: string;
  onPress: (program: CatalogListItem) => void;
  onCheckboxPress: (program: CatalogListItem, e: any) => void;
}

const ProgramCard = React.memo(function ProgramCard({
  program,
  featured = false,
  isSelected,
  isDark,
  colors,
  categoryConfig,
  difficultyColor,
  onPress,
  onCheckboxPress,
}: ProgramCardProps) {
  return (
    <Pressable
      onPress={() => onPress(program)}
      style={({ pressed }) => [
        styles.programCard,
        featured ? styles.featuredCard : styles.regularCard,
        {
          backgroundColor: isDark ? colors.elevated : colors.card,
          borderColor: isSelected ? colors.tint : colors.separator,
          borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {/* Gradient accent bar */}
      <LinearGradient
        colors={categoryConfig.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardAccent}
      />

      <View style={styles.cardContent}>
        {/* Absolute Top-Right Checkbox */}
        <Pressable
          onPress={(e) => onCheckboxPress(program, e)}
          hitSlop={12}
          style={[
            styles.checkboxContainer,
            {
              backgroundColor: isSelected ? colors.tint : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
              borderColor: isSelected ? colors.tint : colors.separator,
            },
          ]}
        >
          {isSelected && <IconSymbol name="checkmark" size={14} color="#fff" />}
        </Pressable>

        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={[styles.typeIcon, { backgroundColor: categoryConfig.gradient[0] + '20' }]}>
            <IconSymbol name={categoryConfig.icon as any} size={16} color={categoryConfig.gradient[0]} />
          </View>

          {/* Installed badge */}
          {program.installed && (
            <View style={[styles.installedBadge, { backgroundColor: colors.success + '20' }]}>
              <IconSymbol name="checkmark.circle.fill" size={12} color={colors.success} />
              <ThemedText style={[styles.installedText, { color: colors.success }]}>Added</ThemedText>
            </View>
          )}
        </View>

        {/* Title */}
        <ThemedText style={styles.cardTitle} numberOfLines={2}>
          {program.name}
        </ThemedText>

        {/* Description */}
        <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {program.description}
        </ThemedText>

        {/* Meta row */}
        <View style={styles.cardMeta}>
          <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
            <ThemedText style={[styles.difficultyText, { color: difficultyColor }]}>
              {program.difficulty?.charAt(0) + program.difficulty?.slice(1).toLowerCase()}
            </ThemedText>
          </View>

          <View style={styles.metaInfo}>
            <IconSymbol name="calendar" size={12} color={colors.textTertiary} />
            <ThemedText style={[styles.metaText, { color: colors.textTertiary }]}>
              {program.duration} weeks
            </ThemedText>
          </View>

          <View style={styles.metaInfo}>
            <IconSymbol name="flame.fill" size={12} color={colors.textTertiary} />
            <ThemedText style={[styles.metaText, { color: colors.textTertiary }]}>
              {program.daysPerWeek}x/week
            </ThemedText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}, (prevProps: ProgramCardProps, nextProps: ProgramCardProps) => {
  // Custom comparison: ONLY check id, name, and isSelected
  // Ignore function prop changes to prevent re-renders
  return (
    prevProps.program.id === nextProps.program.id &&
    prevProps.program.name === nextProps.program.name &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDark === nextProps.isDark
  );
});

export default function BrowseScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allPrograms, setAllPrograms] = useState<CatalogListItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [detailProgram, setDetailProgram] = useState<CatalogListItem | null>(null);

  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo;
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const selection = useSelection<ProgramDisplayItem>();

  const hasActiveFilters = typeFilter !== 'All' || difficultyFilter !== 'All' || searchQuery !== '';
  const activeFilterCount = (typeFilter !== 'All' ? 1 : 0) + (difficultyFilter !== 'All' ? 1 : 0);

  // Load all programs once
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await programsService.listCatalog({
          limit: 100,
          offset: 0,
        });
        setAllPrograms(res.items);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Filter programs based on search and filters
  const filteredPrograms = useMemo(() => {
    return allPrograms.filter(p => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (typeFilter !== 'All' && p.type !== typeFilter) return false;
      if (difficultyFilter !== 'All' && p.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [allPrograms, searchQuery, typeFilter, difficultyFilter]);

  // Group programs by type for section display
  const programsByCategory = useMemo(() => {
    const groups: Record<string, CatalogListItem[]> = {};
    for (const program of filteredPrograms) {
      const type = program.type || 'OTHER';
      if (!groups[type]) groups[type] = [];
      groups[type].push(program);
    }
    return groups;
  }, [filteredPrograms]);

  // Featured programs (top rated / popular)
  const featuredPrograms = useMemo(() => {
    return filteredPrograms
      .filter(p => !p.installed)
      .slice(0, 5);
  }, [filteredPrograms]);

  const handleReturnBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (returnTo) {
      router.push(returnTo as any);
    } else if (router.canGoBack()) {
      router.back();
    }
  }, [returnTo, router]);

  const handleAddSelected = async () => {
    if (selection.selectedCount === 0) return;

    setIsAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const addedCount = await programsService.installProgramsByCatalogIds(
        Array.from(selection.selectedIds)
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      selection.clear();

      const message = `Added ${addedCount} program${addedCount !== 1 ? 's' : ''}!`;

      if (Platform.OS === 'web') {
        if (window.confirm(`${message} View now?`)) {
          router.push('/(tabs)');
        }
      } else {
        Alert.alert('Added!', message, [
          { text: 'View', onPress: () => router.push('/(tabs)') },
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

  const clearFilters = () => {
    setTypeFilter('All');
    setDifficultyFilter('All');
    setSearchQuery('');
  };

  // Tap card = open detail modal
  const handleProgramPress = useCallback((program: CatalogListItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDetailProgram(program);
  }, []);

  // Tap checkbox = toggle selection
  const handleCheckboxPress = useCallback((program: CatalogListItem, e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selection.toggle(program);
  }, [selection]);

  // Add single program from detail modal
  const handleAddSingleProgram = async (program: CatalogListItem) => {
    setIsAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await programsService.installProgramsByCatalogIds([program.id]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDetailProgram(null);
      // Reload to update installed status
      const res = await programsService.listCatalog({ limit: 100, offset: 0 });
      setAllPrograms(res.items);
      const msg = `${program.name} added!`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Added!', msg);
    } catch (e) {
      console.error(e);
      const msg = 'Failed to add program';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setIsAdding(false);
    }
  };

  // Render a program card using the memoized component
  const renderProgramCard = useCallback((program: CatalogListItem, featured = false) => {
    const isSelected = selection.isSelected(program);
    const categoryConfig = CATEGORY_CONFIG[program.type] || CATEGORY_CONFIG['FULL_BODY'];
    const difficultyColor = DIFFICULTY_COLORS[program.difficulty] || colors.textSecondary;

    return (
      <ProgramCard
        key={program.id}
        program={program}
        featured={featured}
        isSelected={isSelected}
        isDark={isDark}
        colors={colors}
        categoryConfig={categoryConfig}
        difficultyColor={difficultyColor}
        onPress={handleProgramPress}
        onCheckboxPress={handleCheckboxPress}
      />
    );
  }, [selection, colors, isDark, handleProgramPress, handleCheckboxPress]);

  // Category Section Component
  const CategorySection = ({ type, programs }: { type: string; programs: CatalogListItem[] }) => {
    const config = CATEGORY_CONFIG[type] || {
      icon: 'figure.mixed.cardio',
      gradient: ['#667EEA', '#764BA2'],
      label: type.replace(/_/g, ' '),
      description: ''
    };

    return (
      <Animated.View
        entering={FadeInDown.duration(400).delay(100)}
        style={styles.categorySection}
      >
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionIconContainer}
          >
            <IconSymbol name={config.icon as any} size={18} color="#fff" />
          </LinearGradient>
          <View style={styles.sectionTitleContainer}>
            <ThemedText style={styles.sectionTitle}>{config.label}</ThemedText>
            <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {config.description} • {programs.length} program{programs.length !== 1 ? 's' : ''}
            </ThemedText>
          </View>
        </View>

        {/* Horizontal scroll of programs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + 12}
        >
          {programs.map((program, index) => (
            <Animated.View
              key={program.id}
              entering={FadeInRight.duration(300).delay(index * 50)}
            >
              {renderProgramCard(program)}
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  return (
    <SwipeTabs current="browse">
      <Screen contentStyle={styles.screenContent}>
        {/* Return Banner */}
        {returnTo && (
          <Pressable
            style={[styles.returnBanner, { backgroundColor: colors.tint + '15', borderColor: colors.tint }]}
            onPress={handleReturnBack}
          >
            <IconSymbol name="chevron.left" size={16} color={colors.tint} />
            <ThemedText style={[styles.returnText, { color: colors.tint }]}>
              Back to Assign Program
            </ThemedText>
          </Pressable>
        )}

        {/* Sticky Search Header */}
        <View style={[styles.header, { backgroundColor: isDark ? colors.background : colors.background }]}>
          {/* Search Bar */}
          <View
            style={[
              styles.searchBar,
              { backgroundColor: isDark ? colors.elevated : colors.card, borderColor: colors.separator },
            ]}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search programs..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery !== '' && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={12}>
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {/* Filter Row */}
          <View style={styles.filterRow}>
            <Pressable
              style={[
                styles.filterButton,
                {
                  backgroundColor: hasActiveFilters ? colors.tint + '15' : isDark ? colors.elevated : colors.card,
                  borderColor: hasActiveFilters ? colors.tint : colors.separator,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFilters(true);
              }}
            >
              <IconSymbol
                name="line.3.horizontal.decrease"
                size={16}
                color={hasActiveFilters ? colors.tint : colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.filterButtonText,
                  { color: hasActiveFilters ? colors.tint : colors.text },
                ]}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </ThemedText>
            </Pressable>

            {/* Active filter pills */}
            {hasActiveFilters && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activePills}
              >
                {typeFilter !== 'All' && (
                  <FilterPill
                    label={typeFilter.replace(/_/g, ' ')}
                    onRemove={() => setTypeFilter('All')}
                    colors={colors}
                  />
                )}
                {difficultyFilter !== 'All' && (
                  <FilterPill
                    label={difficultyFilter.charAt(0) + difficultyFilter.slice(1).toLowerCase()}
                    onRemove={() => setDifficultyFilter('All')}
                    colors={colors}
                  />
                )}
              </ScrollView>
            )}

            <View style={styles.resultCount}>
              <ThemedText style={[styles.resultText, { color: colors.textSecondary }]}>
                {filteredPrograms.length}
              </ThemedText>
            </View>
          </View>

          {/* Selection indicator */}
          {selection.hasSelection && (
            <View style={styles.selectionRow}>
              <ThemedText style={[styles.selectionText, { color: colors.tint }]}>
                {selection.selectedCount} selected
              </ThemedText>
              <Pressable onPress={selection.clear} hitSlop={12}>
                <ThemedText style={[styles.clearText, { color: colors.textSecondary }]}>
                  Clear
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Main Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : filteredPrograms.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="magnifyingglass" size={40} color={colors.textTertiary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No programs found
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Try different search terms or filters
            </ThemedText>
            {hasActiveFilters && (
              <Pressable
                style={[styles.clearFiltersButton, { borderColor: colors.separator }]}
                onPress={clearFilters}
              >
                <ThemedText style={[styles.clearFiltersText, { color: colors.tint }]}>
                  Clear Filters
                </ThemedText>
              </Pressable>
            )}
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: selection.hasSelection ? 120 : 40 },
            ]}
          >
            {/* Featured Section - only show if not filtering */}
            {!hasActiveFilters && featuredPrograms.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.featuredSection}>
                <View style={styles.sectionHeader}>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sectionIconContainer}
                  >
                    <IconSymbol name="star.fill" size={18} color="#fff" />
                  </LinearGradient>
                  <View style={styles.sectionTitleContainer}>
                    <ThemedText style={styles.sectionTitle}>Featured Programs</ThemedText>
                    <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                      Top picks for you
                    </ThemedText>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredScroll}
                  decelerationRate="fast"
                  snapToInterval={FEATURED_CARD_WIDTH + 16}
                >
                  {featuredPrograms.map((program, index) => (
                    <Animated.View
                      key={program.id}
                      entering={FadeInRight.duration(300).delay(index * 80)}
                    >
                      {renderProgramCard(program, true)}
                    </Animated.View>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {/* Category Sections */}
            {Object.entries(programsByCategory)
              .sort(([a], [b]) => {
                // Sort by predefined order
                const order = ['STRENGTH', 'HYPERTROPHY', 'BODYWEIGHT', 'FULL_BODY', 'ATHLETIC', 'POWERLIFTING'];
                return order.indexOf(a) - order.indexOf(b);
              })
              .map(([type, programs]) => (
                <CategorySection key={type} type={type} programs={programs} />
              ))
            }
          </ScrollView>
        )}

        {/* Floating Add Button */}
        {selection.hasSelection && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.floatingBar, { paddingBottom: insets.bottom + 10 }]}
          >
            <LinearGradient
              colors={[colors.tint, colors.tint + 'DD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.addButtonGradient}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  { opacity: pressed || isAdding ? 0.9 : 1 },
                ]}
                onPress={handleAddSelected}
                disabled={isAdding}
              >
                <IconSymbol name="plus" size={18} color="#fff" />
                <ThemedText style={styles.addButtonText}>
                  {isAdding ? 'Adding...' : `Add ${selection.selectedCount} Program${selection.selectedCount > 1 ? 's' : ''}`}
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Filter Modal */}
        <FilterModal
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          typeFilter={typeFilter}
          difficultyFilter={difficultyFilter}
          onTypeChange={setTypeFilter}
          onDifficultyChange={setDifficultyFilter}
          onClear={clearFilters}
          colors={colors}
          colorScheme={colorScheme}
        />

        {/* Program Detail Modal */}
        <ProgramDetailModal
          program={detailProgram}
          onClose={() => setDetailProgram(null)}
          onAdd={handleAddSingleProgram}
          isAdding={isAdding}
          colors={colors}
          isDark={isDark}
        />
      </Screen>
    </SwipeTabs>
  );
}

// Filter Pill Component
function FilterPill({
  label,
  onRemove,
  colors,
}: {
  label: string;
  onRemove: () => void;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.tint + '15' }]}>
      <ThemedText style={[styles.pillText, { color: colors.tint }]}>{label}</ThemedText>
      <Pressable onPress={onRemove} hitSlop={8}>
        <IconSymbol name="xmark" size={12} color={colors.tint} />
      </Pressable>
    </View>
  );
}

// Filter Modal Component (unchanged)
function FilterModal({
  visible,
  onClose,
  typeFilter,
  difficultyFilter,
  onTypeChange,
  onDifficultyChange,
  onClear,
  colors,
  colorScheme,
}: {
  visible: boolean;
  onClose: () => void;
  typeFilter: string;
  difficultyFilter: string;
  onTypeChange: (v: string) => void;
  onDifficultyChange: (v: string) => void;
  onClear: () => void;
  colors: (typeof Colors)['light'];
  colorScheme: 'light' | 'dark' | null | undefined;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colorScheme === 'dark' ? colors.elevated : colors.card },
              ]}
            >
              <View style={[styles.modalHandle, { backgroundColor: colors.separator }]} />
              <View style={styles.modalHeader}>
                <Pressable onPress={onClear}>
                  <ThemedText style={[styles.modalClear, { color: colors.tint }]}>Reset</ThemedText>
                </Pressable>
                <ThemedText style={styles.modalTitle}>Filters</ThemedText>
                <Pressable onPress={onClose}>
                  <ThemedText style={[styles.modalDone, { color: colors.tint }]}>Done</ThemedText>
                </Pressable>
              </View>

              <View style={styles.filterSection}>
                <ThemedText style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>
                  PROGRAM TYPE
                </ThemedText>
                <View style={styles.optionGrid}>
                  {FILTER_OPTIONS.type.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: typeFilter === opt.value ? colors.tint : colors.groupedBackground,
                          borderColor: typeFilter === opt.value ? colors.tint : colors.separator,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onTypeChange(opt.value);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.optionText,
                          { color: typeFilter === opt.value ? '#fff' : colors.text },
                        ]}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <ThemedText style={[styles.filterSectionTitle, { color: colors.textSecondary }]}>
                  DIFFICULTY LEVEL
                </ThemedText>
                <View style={styles.optionGrid}>
                  {FILTER_OPTIONS.difficulty.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: difficultyFilter === opt.value ? colors.tint : colors.groupedBackground,
                          borderColor: difficultyFilter === opt.value ? colors.tint : colors.separator,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onDifficultyChange(opt.value);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.optionText,
                          { color: difficultyFilter === opt.value ? '#fff' : colors.text },
                        ]}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// Program Detail Modal Component
function ProgramDetailModal({
  program,
  onClose,
  onAdd,
  isAdding,
  colors,
  isDark,
}: {
  program: CatalogListItem | null;
  onClose: () => void;
  onAdd: (program: CatalogListItem) => void;
  isAdding: boolean;
  colors: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1); // Default expand week 1
  const [expandedWorkout, setExpandedWorkout] = useState<string | null>(null);

  // Get full program with multi-week Kaggle data when available
  const workouts = useMemo(() => {
    if (!program) return [];

    // Try to get full multi-week data from Kaggle
    const kagglePrograms = getKagglePrograms();
    const kaggleProgram = kagglePrograms.find(
      p => p.id === program.id || p.name.toLowerCase() === program.name.toLowerCase()
    );

    if (kaggleProgram && kaggleProgram.workouts.length > 0) {
      const maxWeek = Math.max(...kaggleProgram.workouts.map(w => w.week || 1), 1);
      if (maxWeek > 1) {
        return kaggleProgram.workouts;
      }
    }

    // Fall back to curated program data
    const fullProgram = programsService.getById(program.id);
    return fullProgram?.workouts || [];
  }, [program]);

  // Group workouts by week
  const workoutsByWeek = useMemo(() => {
    const groups: Record<number, typeof workouts> = {};
    workouts.forEach((w: any) => {
      const week = w.week || 1;
      if (!groups[week]) groups[week] = [];
      groups[week].push(w);
    });
    return groups;
  }, [workouts]);

  const weekNumbers = Object.keys(workoutsByWeek).map(Number).sort((a, b) => a - b);
  const hasMultipleWeeks = weekNumbers.length > 1;

  if (!program) return null;

  const categoryConfig = CATEGORY_CONFIG[program.type] || CATEGORY_CONFIG['FULL_BODY'];
  const difficultyColor = DIFFICULTY_COLORS[program.difficulty] || colors.textSecondary;

  const toggleWeek = (week: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWeek(prev => prev === week ? null : week);
  };

  const toggleWorkout = (workoutKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedWorkout(prev => prev === workoutKey ? null : workoutKey);
  };

  return (
    <Modal visible={!!program} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.detailModalOverlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.detailModalContent,
                { backgroundColor: isDark ? colors.elevated : colors.card },
              ]}
            >
              {/* Handle */}
              <View style={[styles.modalHandle, { backgroundColor: colors.separator }]} />

              {/* Header with gradient */}
              <LinearGradient
                colors={categoryConfig.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.detailHeader}
              >
                <View style={styles.detailHeaderContent}>
                  <IconSymbol name={categoryConfig.icon as any} size={32} color="#fff" />
                  <ThemedText style={styles.detailTitle}>{program.name}</ThemedText>
                </View>
              </LinearGradient>

              {/* Info Grid */}
              <View style={styles.detailInfoGrid}>
                <View style={[styles.detailInfoItem, { backgroundColor: colors.groupedBackground }]}>
                  <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Difficulty</ThemedText>
                  <View style={[styles.difficultyBadgeLarge, { backgroundColor: difficultyColor + '20' }]}>
                    <ThemedText style={[styles.difficultyTextLarge, { color: difficultyColor }]}>
                      {program.difficulty?.charAt(0) + program.difficulty?.slice(1).toLowerCase()}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.detailInfoItem, { backgroundColor: colors.groupedBackground }]}>
                  <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Duration</ThemedText>
                  <ThemedText style={styles.detailInfoValue}>{program.duration} weeks</ThemedText>
                </View>
                <View style={[styles.detailInfoItem, { backgroundColor: colors.groupedBackground }]}>
                  <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Frequency</ThemedText>
                  <ThemedText style={styles.detailInfoValue}>{program.daysPerWeek}x/week</ThemedText>
                </View>
              </View>

              {/* Description */}
              <View style={styles.detailDescriptionContainer}>
                <ThemedText style={[styles.detailDescription, { color: colors.textSecondary }]}>
                  {program.description || 'No description available.'}
                </ThemedText>
              </View>

              {/* Workouts Section */}
              <View style={styles.workoutsSectionHeader}>
                <ThemedText style={[styles.workoutsSectionTitle, { color: colors.text }]}>
                  Workout Schedule
                </ThemedText>
                <ThemedText style={[styles.workoutsCount, { color: colors.textSecondary }]}>
                  {workouts.length} days
                </ThemedText>
              </View>

              {/* Workout List - Grouped by Week */}
              <ScrollView
                style={styles.workoutsScrollContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.workoutsScrollContent}
              >
                {workouts.length === 0 ? (
                  <ThemedText style={[styles.noWorkoutsText, { color: colors.textTertiary }]}>
                    No workout details available
                  </ThemedText>
                ) : hasMultipleWeeks ? (
                  // Show week sections when multiple weeks
                  weekNumbers.map((weekNum) => {
                    const weekWorkouts = workoutsByWeek[weekNum] || [];
                    const isWeekExpanded = expandedWeek === weekNum;

                    return (
                      <View key={`week-${weekNum}`} style={styles.weekSection}>
                        {/* Week Header */}
                        <Pressable
                          onPress={() => toggleWeek(weekNum)}
                          style={[styles.weekHeader, { backgroundColor: colors.groupedBackground }]}
                        >
                          <View style={styles.weekHeaderLeft}>
                            <View style={[styles.weekBadge, { backgroundColor: categoryConfig.gradient[0] }]}>
                              <ThemedText style={styles.weekBadgeText}>W{weekNum}</ThemedText>
                            </View>
                            <ThemedText style={styles.weekTitle}>
                              Week {weekNum}
                            </ThemedText>
                            <ThemedText style={[styles.weekDayCount, { color: colors.textSecondary }]}>
                              {weekWorkouts.length} day{weekWorkouts.length !== 1 ? 's' : ''}
                            </ThemedText>
                          </View>
                          <IconSymbol
                            name={isWeekExpanded ? 'chevron.up' : 'chevron.down'}
                            size={14}
                            color={colors.textSecondary}
                          />
                        </Pressable>

                        {/* Week's Workouts */}
                        {isWeekExpanded && weekWorkouts.map((workout: any, wIdx: number) => {
                          const workoutKey = `w${weekNum}-d${workout.day}`;
                          const isExpanded = expandedWorkout === workoutKey;
                          const exercises = workout.exercises || [];

                          return (
                            <View
                              key={workoutKey}
                              style={[styles.workoutAccordion, { backgroundColor: colors.elevated, marginLeft: 12 }]}
                            >
                              <Pressable
                                onPress={() => toggleWorkout(workoutKey)}
                                style={({ pressed }) => [
                                  styles.workoutAccordionHeader,
                                  { opacity: pressed ? 0.8 : 1 },
                                ]}
                              >
                                <View style={styles.workoutAccordionLeft}>
                                  <View style={[styles.workoutDayBadge, { backgroundColor: categoryConfig.gradient[0] + '80' }]}>
                                    <ThemedText style={styles.workoutDayText}>D{workout.day}</ThemedText>
                                  </View>
                                  <View style={styles.workoutAccordionInfo}>
                                    <ThemedText style={styles.workoutAccordionTitle} numberOfLines={1}>
                                      {workout.name || `Day ${workout.day}`}
                                    </ThemedText>
                                    <ThemedText style={[styles.workoutExerciseCount, { color: colors.textSecondary }]}>
                                      {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                                    </ThemedText>
                                  </View>
                                </View>
                                <IconSymbol
                                  name={isExpanded ? 'chevron.up' : 'chevron.down'}
                                  size={14}
                                  color={colors.textSecondary}
                                />
                              </Pressable>

                              {isExpanded && (
                                <View style={[styles.exercisesContainer, { borderTopColor: colors.separator }]}>
                                  {exercises.map((ex: any, exIndex: number) => (
                                    <View
                                      key={`ex-${exIndex}`}
                                      style={[
                                        styles.exerciseRow,
                                        exIndex < exercises.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }
                                      ]}
                                    >
                                      <View style={[styles.exerciseIndexBadge, { backgroundColor: colors.tint + '15' }]}>
                                        <ThemedText style={[styles.exerciseIndexText, { color: colors.tint }]}>{exIndex + 1}</ThemedText>
                                      </View>
                                      <View style={styles.exerciseInfo}>
                                        <ThemedText style={styles.exerciseNameDetail} numberOfLines={1}>{ex.name}</ThemedText>
                                        <ThemedText style={[styles.exerciseSetsReps, { color: colors.textSecondary }]}>
                                          {ex.sets} sets × {ex.reps}{ex.weight ? ` @ ${ex.weight}` : ''}
                                        </ThemedText>
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                ) : (
                  // Single week - show days directly without week header
                  workouts.map((workout: any, index: number) => {
                    const workoutKey = `d${workout.day}-${index}`;
                    const isExpanded = expandedWorkout === workoutKey;
                    const exercises = workout.exercises || [];

                    return (
                      <View
                        key={workoutKey}
                        style={[styles.workoutAccordion, { backgroundColor: colors.groupedBackground }]}
                      >
                        <Pressable
                          onPress={() => toggleWorkout(workoutKey)}
                          style={({ pressed }) => [
                            styles.workoutAccordionHeader,
                            { opacity: pressed ? 0.8 : 1 },
                          ]}
                        >
                          <View style={styles.workoutAccordionLeft}>
                            <View style={[styles.workoutDayBadge, { backgroundColor: categoryConfig.gradient[0] }]}>
                              <ThemedText style={styles.workoutDayText}>D{workout.day}</ThemedText>
                            </View>
                            <View style={styles.workoutAccordionInfo}>
                              <ThemedText style={styles.workoutAccordionTitle} numberOfLines={1}>
                                {workout.name || `Day ${index + 1}`}
                              </ThemedText>
                              <ThemedText style={[styles.workoutExerciseCount, { color: colors.textSecondary }]}>
                                {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
                              </ThemedText>
                            </View>
                          </View>
                          <IconSymbol
                            name={isExpanded ? 'chevron.up' : 'chevron.down'}
                            size={14}
                            color={colors.textSecondary}
                          />
                        </Pressable>

                        {isExpanded && (
                          <View style={[styles.exercisesContainer, { borderTopColor: colors.separator }]}>
                            {exercises.map((ex: any, exIndex: number) => (
                              <View
                                key={`ex-${exIndex}`}
                                style={[
                                  styles.exerciseRow,
                                  exIndex < exercises.length - 1 && { borderBottomColor: colors.separator, borderBottomWidth: StyleSheet.hairlineWidth }
                                ]}
                              >
                                <View style={[styles.exerciseIndexBadge, { backgroundColor: colors.tint + '15' }]}>
                                  <ThemedText style={[styles.exerciseIndexText, { color: colors.tint }]}>{exIndex + 1}</ThemedText>
                                </View>
                                <View style={styles.exerciseInfo}>
                                  <ThemedText style={styles.exerciseNameDetail} numberOfLines={1}>{ex.name}</ThemedText>
                                  <ThemedText style={[styles.exerciseSetsReps, { color: colors.textSecondary }]}>
                                    {ex.sets} sets × {ex.reps}{ex.weight ? ` @ ${ex.weight}` : ''}
                                  </ThemedText>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.detailActions}>
                {program.installed ? (
                  <View style={[styles.alreadyAddedBadge, { backgroundColor: colors.success + '15' }]}>
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                    <ThemedText style={[styles.alreadyAddedText, { color: colors.success }]}>
                      Already in My Programs
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.addProgramButton,
                      { backgroundColor: colors.tint, opacity: pressed || isAdding ? 0.85 : 1 },
                    ]}
                    onPress={() => onAdd(program)}
                    disabled={isAdding}
                  >
                    <IconSymbol name="plus" size={18} color="#fff" />
                    <ThemedText style={styles.addProgramButtonText}>
                      {isAdding ? 'Adding...' : 'Add to My Programs'}
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  style={[styles.closeDetailButton, { borderColor: colors.separator }]}
                  onPress={onClose}
                >
                  <ThemedText style={[styles.closeDetailText, { color: colors.text }]}>Close</ThemedText>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 0,
  },
  returnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  returnText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterButtonText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  activePills: {
    gap: 6,
    paddingRight: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  pillText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  resultCount: {
    marginLeft: 'auto',
  },
  resultText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  selectionText: {
    ...Typography.caption1,
    fontWeight: '600',
  },
  clearText: {
    ...Typography.caption1,
  },
  scrollContent: {
    paddingTop: Spacing.md,
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
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.headline,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.subhead,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: Spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clearFiltersText: {
    ...Typography.subhead,
    fontWeight: '600',
  },

  // Featured Section
  featuredSection: {
    marginBottom: Spacing.lg,
  },
  featuredScroll: {
    paddingHorizontal: Spacing.md,
    gap: 16,
  },

  // Category Section
  categorySection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 12,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: '700',
  },
  sectionSubtitle: {
    ...Typography.caption1,
    marginTop: 2,
  },
  horizontalScroll: {
    paddingHorizontal: Spacing.md,
    gap: 12,
  },

  // Program Card
  programCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  regularCard: {
    width: CARD_WIDTH,
  },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
  },
  cardAccent: {
    height: 4,
  },
  cardContent: {
    padding: Spacing.md,
    gap: 8,
    position: 'relative',
  },
  checkboxContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  installedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginLeft: 'auto',
  },
  installedText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  cardTitle: {
    ...Typography.headline,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardDescription: {
    ...Typography.subhead,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  difficultyText: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.caption2,
  },

  // Floating Bar
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  addButtonGradient: {
    borderRadius: Radius.lg,
    ...Shadows.lg,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  addButtonText: {
    ...Typography.headline,
    color: '#fff',
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  modalClear: {
    ...Typography.body,
  },
  modalTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  modalDone: {
    ...Typography.body,
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  filterSectionTitle: {
    ...Typography.caption1,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    ...Typography.subhead,
    fontWeight: '500',
  },

  // Program Detail Modal Styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '85%',
  },
  detailHeader: {
    padding: Spacing.lg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  detailHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailTitle: {
    ...Typography.title2,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  detailInfoGrid: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  detailInfoItem: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    gap: 4,
  },
  detailInfoLabel: {
    ...Typography.caption2,
    fontWeight: '600',
  },
  detailInfoValue: {
    ...Typography.subhead,
    fontWeight: '700',
  },
  difficultyBadgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  difficultyTextLarge: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  detailDescriptionContainer: {
    paddingHorizontal: Spacing.md,
    maxHeight: 120,
  },
  detailDescription: {
    ...Typography.body,
    lineHeight: 22,
  },
  detailActions: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  alreadyAddedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  alreadyAddedText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  addProgramButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  addProgramButtonText: {
    ...Typography.headline,
    color: '#fff',
    fontWeight: '600',
  },
  closeDetailButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  closeDetailText: {
    ...Typography.subhead,
    fontWeight: '500',
  },

  // Workout Accordion Styles
  workoutsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  workoutsSectionTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  workoutsCount: {
    ...Typography.caption1,
  },
  workoutsScrollContainer: {
    maxHeight: 280,
    paddingHorizontal: Spacing.md,
  },
  workoutsScrollContent: {
    gap: Spacing.xs,
  },
  noWorkoutsText: {
    ...Typography.subhead,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  workoutAccordion: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  workoutAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  workoutAccordionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  workoutDayBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutDayText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  workoutAccordionInfo: {
    flex: 1,
    gap: 1,
  },
  workoutAccordionTitle: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  workoutExerciseCount: {
    ...Typography.caption2,
  },
  exercisesContainer: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  exerciseIndexBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: {
    fontSize: 10,
    fontWeight: '700',
  },
  exerciseInfo: {
    flex: 1,
    gap: 1,
  },
  exerciseNameDetail: {
    ...Typography.subhead,
    fontWeight: '500',
  },
  exerciseSetsReps: {
    ...Typography.caption2,
  },

  // Week grouping styles
  weekSection: {
    marginBottom: Spacing.sm,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  weekHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weekBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
  },
  weekBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  weekTitle: {
    ...Typography.headline,
    fontWeight: '600',
  },
  weekDayCount: {
    ...Typography.caption1,
    marginLeft: 4,
  },
});
