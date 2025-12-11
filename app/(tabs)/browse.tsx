import { useState, useMemo } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  filterPrograms,
  getProgramTypes,
  getProgramDifficulties,
  type KaggleProgram,
  type ProgramFilters,
} from '@/lib/kaggle-programs';

export default function BrowseScreen() {
  const [filters, setFilters] = useState<ProgramFilters>({
    type: 'ALL',
    difficulty: 'ALL',
    duration: 'ALL',
    search: '',
  });
  const [expandedFilters, setExpandedFilters] = useState(false);

  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Filter programs based on current filters
  const programs = useMemo(() => {
    return filterPrograms(filters);
  }, [filters]);

  const programTypes = useMemo(() => getProgramTypes(), []);
  const difficulties = useMemo(() => getProgramDifficulties(), []);

  const updateFilter = (key: keyof ProgramFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: 'ALL',
      difficulty: 'ALL',
      duration: 'ALL',
      search: '',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'STRENGTH':
        return '#F44336';
      case 'HYPERTROPHY':
        return '#2196F3';
      case 'ENDURANCE':
        return '#4CAF50';
      case 'ATHLETIC':
        return '#FF9800';
      case 'BODYWEIGHT':
        return '#9C27B0';
      case 'WEIGHT_LOSS':
        return '#FF5722';
      default:
        return colors.tint;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'BEGINNER':
        return '#4CAF50';
      case 'INTERMEDIATE':
        return '#FF9800';
      case 'ADVANCED':
        return '#F44336';
      default:
        return colors.text;
    }
  };

  const renderProgram = ({ item }: { item: KaggleProgram }) => (
    <TouchableOpacity
      style={[styles.programCard, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}
      onPress={() => router.push(`/browse/${item.id}`)}
    >
      <ThemedView style={styles.programHeader}>
        <ThemedText type="subtitle" style={styles.programName} numberOfLines={2}>
          {item.name}
        </ThemedText>
      </ThemedView>

      {item.description && (
        <ThemedText style={styles.description} numberOfLines={2}>
          {item.description}
        </ThemedText>
      )}

      <ThemedView style={styles.badges}>
        <ThemedView
          style={[styles.badge, { backgroundColor: getTypeColor(item.type) + '20' }]}
        >
          <ThemedText style={[styles.badgeText, { color: getTypeColor(item.type) }]}>
            {item.type}
          </ThemedText>
        </ThemedView>
        <ThemedView
          style={[styles.badge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}
        >
          <ThemedText style={[styles.badgeText, { color: getDifficultyColor(item.difficulty) }]}>
            {item.difficulty}
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.stats}>
        <ThemedView style={styles.stat}>
          <IconSymbol name="calendar" size={14} color={colors.text} />
          <ThemedText style={styles.statText}>{item.duration} weeks</ThemedText>
        </ThemedView>
        <ThemedView style={styles.stat}>
          <IconSymbol name="figure.strengthtraining.traditional" size={14} color={colors.text} />
          <ThemedText style={styles.statText}>{item.workouts.length} workouts</ThemedText>
        </ThemedView>
      </ThemedView>

      {item.muscleGroups.length > 0 && (
        <ThemedView style={styles.muscleGroups}>
          <ThemedText style={styles.muscleGroupsText} numberOfLines={1}>
            🎯 {item.muscleGroups.slice(0, 3).join(', ')}
            {item.muscleGroups.length > 3 && ` +${item.muscleGroups.length - 3}`}
          </ThemedText>
        </ThemedView>
      )}
    </TouchableOpacity>
  );

  const renderFilterChip = (label: string, value: string, activeValue: string, onPress: () => void) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: value === activeValue ? colors.tint : colors.background,
          borderColor: value === activeValue ? colors.tint : colors.text + '30',
        },
      ]}
      onPress={onPress}
    >
      <ThemedText
        style={[
          styles.filterChipText,
          { color: value === activeValue ? '#fff' : colors.text },
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedText type="title">Browse Programs</ThemedText>
        <ThemedText style={styles.subtitle}>
          {programs.length} program{programs.length !== 1 ? 's' : ''} available
        </ThemedText>
      </ThemedView>

      {/* Search Bar */}
      <ThemedView style={[styles.searchContainer, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.text} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search programs..."
          placeholderTextColor={colors.text + '60'}
          value={filters.search}
          onChangeText={(text) => updateFilter('search', text)}
        />
        {filters.search !== '' && (
          <TouchableOpacity onPress={() => updateFilter('search', '')}>
            <IconSymbol name="xmark.circle.fill" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </ThemedView>

      {/* Filter Toggle */}
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setExpandedFilters(!expandedFilters)}
      >
        <IconSymbol name="slider.horizontal.3" size={18} color={colors.tint} />
        <ThemedText style={[styles.filterToggleText, { color: colors.tint }]}>
          {expandedFilters ? 'Hide Filters' : 'Show Filters'}
        </ThemedText>
      </TouchableOpacity>

      {/* Expanded Filters */}
      {expandedFilters && (
        <ThemedView style={styles.filtersContainer}>
          {/* Type Filter */}
          <ThemedView style={styles.filterSection}>
            <ThemedText style={styles.filterLabel}>Type</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {renderFilterChip('All', 'ALL', filters.type || 'ALL', () => updateFilter('type', 'ALL'))}
              {programTypes.map(type => renderFilterChip(type, type, filters.type || 'ALL', () => updateFilter('type', type)))}
            </ScrollView>
          </ThemedView>

          {/* Difficulty Filter */}
          <ThemedView style={styles.filterSection}>
            <ThemedText style={styles.filterLabel}>Difficulty</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {renderFilterChip('All', 'ALL', filters.difficulty || 'ALL', () => updateFilter('difficulty', 'ALL'))}
              {difficulties.map(diff => renderFilterChip(diff, diff, filters.difficulty || 'ALL', () => updateFilter('difficulty', diff)))}
            </ScrollView>
          </ThemedView>

          {/* Duration Filter */}
          <ThemedView style={styles.filterSection}>
            <ThemedText style={styles.filterLabel}>Duration</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {renderFilterChip('All', 'ALL', filters.duration || 'ALL', () => updateFilter('duration', 'ALL'))}
              {renderFilterChip('1-4 weeks', 'SHORT', filters.duration || 'ALL', () => updateFilter('duration', 'SHORT'))}
              {renderFilterChip('5-8 weeks', 'MEDIUM', filters.duration || 'ALL', () => updateFilter('duration', 'MEDIUM'))}
              {renderFilterChip('9-12 weeks', 'LONG', filters.duration || 'ALL', () => updateFilter('duration', 'LONG'))}
              {renderFilterChip('12+ weeks', 'EXTENDED', filters.duration || 'ALL', () => updateFilter('duration', 'EXTENDED'))}
            </ScrollView>
          </ThemedView>

          {/* Clear Filters */}
          <TouchableOpacity
            style={[styles.clearButton, { borderColor: colors.text + '30' }]}
            onPress={clearFilters}
          >
            <IconSymbol name="xmark" size={16} color={colors.text} />
            <ThemedText style={styles.clearButtonText}>Clear All Filters</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {/* Programs List */}
      {programs.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <IconSymbol name="magnifyingglass" size={48} color={colors.text + '40'} />
          <ThemedText type="subtitle">No programs found</ThemedText>
          <ThemedText style={styles.emptyText}>
            Try adjusting your filters or search query
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={programs}
          renderItem={renderProgram}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
    paddingTop: 50,
  },
  subtitle: {
    opacity: 0.6,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 12,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filtersContainer: {
    gap: 12,
    marginBottom: 16,
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    gap: 12,
    paddingBottom: 20,
  },
  programCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  programHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  programName: {
    flex: 1,
  },
  description: {
    opacity: 0.7,
    fontSize: 14,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    opacity: 0.7,
  },
  muscleGroups: {
    paddingTop: 4,
  },
  muscleGroupsText: {
    fontSize: 12,
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    paddingHorizontal: 32,
  },
});
