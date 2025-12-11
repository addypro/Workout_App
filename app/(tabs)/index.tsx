import { useState, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPrograms, type Program } from '@/lib/db/storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useFocusEffect(
    useCallback(() => {
      loadPrograms();
    }, [])
  );

  async function loadPrograms() {
    try {
      setLoading(true);
      const data = await getPrograms();
      setPrograms(data);
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return '#4CAF50';
      case 'MAPPING':
        return '#FF9800';
      case 'PARSING':
        return '#2196F3';
      case 'ERROR':
        return '#F44336';
      default:
        return colors.text;
    }
  };

  const renderProgram = ({ item }: { item: Program }) => (
    <ThemedView
      style={[styles.programCard, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}
    >
      <ThemedView style={styles.programHeader}>
        <ThemedText type="subtitle" style={styles.programName}>
          {item.name}
        </ThemedText>
        <ThemedView
          style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}
        >
          <ThemedText
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {item.status}
          </ThemedText>
        </ThemedView>
      </ThemedView>
      {item.description && (
        <ThemedText style={styles.description}>{item.description}</ThemedText>
      )}
      <ThemedText style={styles.date}>
        {new Date(item.createdAt).toLocaleDateString()}
      </ThemedText>

      {item.status === 'READY' && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push(`/workout/${item.id}`)}
        >
          <IconSymbol name="play.fill" size={16} color="#fff" />
          <ThemedText style={styles.startButtonText}>Start Workout</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">My Programs</ThemedText>
        <ThemedText style={styles.subtitle}>
          {programs.length} program{programs.length !== 1 ? 's' : ''}
        </ThemedText>
      </ThemedView>

      {programs.length === 0 ? (
        <ThemedView style={styles.emptyState}>
          <ThemedText style={styles.emptyEmoji}>💪</ThemedText>
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            Ready to get started?
          </ThemedText>
          <ThemedText style={styles.emptyText}>
            Browse 2,598 expert-designed programs{'\n'}or create your own
          </ThemedText>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/(tabs)/browse')}
          >
            <IconSymbol name="square.grid.2x2" size={20} color="#fff" />
            <ThemedText style={styles.emptyButtonText}>
              Browse Programs
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emptyButtonSecondary, { borderColor: colors.tint }]}
            onPress={() => router.push('/(tabs)/upload')}
          >
            <IconSymbol name="arrow.up.circle" size={20} color={colors.tint} />
            <ThemedText style={[styles.emptyButtonSecondaryText, { color: colors.tint }]}>
              Upload Program
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <FlatList
          data={programs}
          renderItem={renderProgram}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
    marginBottom: 20,
    paddingTop: 50,
  },
  subtitle: {
    opacity: 0.6,
    marginTop: 4,
  },
  list: {
    gap: 12,
  },
  programCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  programHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  programName: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    opacity: 0.7,
    fontSize: 14,
  },
  date: {
    opacity: 0.5,
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 8,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  emptyButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
