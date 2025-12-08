import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { searchExercises, type ExerciseDatabaseEntry } from '@/lib/services/exercise/database';

export default function ExercisesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<ExerciseDatabaseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    handleSearch(searchQuery);
  }, [searchQuery]);

  async function handleSearch(query: string) {
    setLoading(true);
    try {
      const results = await searchExercises(query);
      setExercises(results);
    } catch (error) {
      console.error('Error searching exercises:', error);
    } finally {
      setLoading(false);
    }
  }

  const renderExercise = ({ item }: { item: ExerciseDatabaseEntry }) => (
    <ThemedView style={[styles.exerciseCard, { borderColor: colors.text + '20' }]}>
      <ThemedText type="subtitle">{item.name}</ThemedText>
      {item.category && (
        <ThemedView style={[styles.categoryBadge, { backgroundColor: colors.tint + '20' }]}>
          <ThemedText style={[styles.categoryText, { color: colors.tint }]}>
            {item.category}
          </ThemedText>
        </ThemedView>
      )}
      {item.equipment && item.equipment.length > 0 && (
        <ThemedText style={styles.equipment}>
          {item.equipment.join(', ')}
        </ThemedText>
      )}
      {item.aliases && item.aliases.length > 0 && (
        <ThemedText style={styles.aliases}>
          Also known as: {item.aliases.slice(0, 3).join(', ')}
        </ThemedText>
      )}
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Exercise Database</ThemedText>
        <ThemedText style={styles.subtitle}>
          {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} found
        </ThemedText>
      </ThemedView>

      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.text + '10',
            color: colors.text,
            borderColor: colors.text + '20',
          },
        ]}
        placeholder="Search exercises..."
        placeholderTextColor={colors.text + '60'}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.tint} style={styles.loader} />
      ) : (
        <FlatList
          data={exercises}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedView style={styles.emptyState}>
              <ThemedText>No exercises found</ThemedText>
              <ThemedText style={styles.emptyText}>
                Try searching for exercises like &quot;bench press&quot; or &quot;squat&quot;
              </ThemedText>
            </ThemedView>
          }
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
  searchInput: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  exerciseCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  equipment: {
    opacity: 0.7,
    fontSize: 14,
  },
  aliases: {
    opacity: 0.5,
    fontSize: 12,
    fontStyle: 'italic',
  },
  loader: {
    marginTop: 32,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    opacity: 0.6,
    textAlign: 'center',
  },
});
