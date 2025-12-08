import { useState, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPrograms, type Program } from '@/lib/db/storage';
import { useFocusEffect } from 'expo-router';

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
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
    <TouchableOpacity
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
    </TouchableOpacity>
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
          <ThemedText type="subtitle">No programs yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Use the Upload tab to add your first workout program
          </ThemedText>
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
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    paddingHorizontal: 32,
  },
});
