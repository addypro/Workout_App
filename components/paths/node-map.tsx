/**
 * NodeMap Component
 *
 * A visual representation of a path's nodes using SVG.
 * Inspired by Brilliant.org's learning path visualization.
 *
 * Features:
 * - Animated node connections
 * - Status-based node coloring
 * - Interactive node selection
 * - Smooth scroll tracking
 */

import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { NodeStatus, Path, PathNode } from '@/lib/services/paths/types';

// ============================================
// CONSTANTS
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NODE_SIZE = 56;
const NODE_SPACING = 80;
const PADDING = Spacing.lg;

// Status colors
const STATUS_COLORS: Record<NodeStatus, { fill: string; stroke: string; text: string }> = {
  locked: { fill: '#E5E5EA', stroke: '#C7C7CC', text: '#8E8E93' },
  available: { fill: '#007AFF', stroke: '#0056B3', text: '#FFFFFF' },
  in_progress: { fill: '#FF9500', stroke: '#CC7700', text: '#FFFFFF' },
  completed: { fill: '#34C759', stroke: '#248A3D', text: '#FFFFFF' },
};

// ============================================
// TYPES
// ============================================

interface NodeMapProps {
  path: Path;
  onNodePress?: (node: PathNode) => void;
  /** Height of the map container */
  height?: number;
}

interface NodeComponentProps {
  node: PathNode;
  screenX: number;
  screenY: number;
  onPress?: (node: PathNode) => void;
  index: number;
}

// ============================================
// NODE COMPONENT
// ============================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function NodeComponent({ node, screenX, screenY, onPress, index }: NodeComponentProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const statusColors = STATUS_COLORS[node.status];

  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const handlePress = useCallback(() => {
    if (node.status !== 'locked') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress?.(node);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [node, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getNodeIcon = (): string => {
    if (node.meta?.icon) return node.meta.icon;

    switch (node.type) {
      case 'workout':
        return node.status === 'completed' ? 'checkmark' : 'dumbbell.fill';
      case 'milestone':
        return 'trophy.fill';
      case 'checkpoint':
        return 'checkmark.seal.fill';
      case 'boss':
        return 'flame.fill';
      case 'rest':
        return 'leaf.fill';
      default:
        return 'circle.fill';
    }
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 50).springify()}
      style={[
        styles.nodeContainer,
        animatedStyle,
        {
          left: screenX - NODE_SIZE / 2,
          top: screenY - NODE_SIZE / 2,
        },
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={node.status === 'locked'}
    >
      {/* Node circle */}
      <View
        style={[
          styles.nodeCircle,
          {
            backgroundColor: statusColors.fill,
            borderColor: statusColors.stroke,
            opacity: node.status === 'locked' ? 0.5 : 1,
          },
        ]}
      >
        <IconSymbol name={getNodeIcon() as any} size={24} color={statusColors.text} />
      </View>

      {/* Progress indicator for in_progress nodes */}
      {node.status === 'in_progress' && node.progress !== undefined && (
        <View style={styles.progressRing}>
          <Svg width={NODE_SIZE + 8} height={NODE_SIZE + 8}>
            <Circle
              cx={(NODE_SIZE + 8) / 2}
              cy={(NODE_SIZE + 8) / 2}
              r={NODE_SIZE / 2 + 2}
              stroke="#FF9500"
              strokeWidth={3}
              strokeDasharray={`${node.progress * Math.PI * (NODE_SIZE + 4)} ${Math.PI * (NODE_SIZE + 4)}`}
              strokeLinecap="round"
              fill="transparent"
              transform={`rotate(-90 ${(NODE_SIZE + 8) / 2} ${(NODE_SIZE + 8) / 2})`}
            />
          </Svg>
        </View>
      )}

      {/* Node label */}
      <View style={styles.nodeLabel}>
        <ThemedText
          style={[
            styles.nodeLabelText,
            { color: node.status === 'locked' ? colors.textSecondary : colors.text },
          ]}
          numberOfLines={1}
        >
          {node.title}
        </ThemedText>
        {node.subtitle && (
          <ThemedText style={[styles.nodeSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {node.subtitle}
          </ThemedText>
        )}
      </View>

      {/* XP badge */}
      {node.meta?.xpReward && node.status !== 'completed' && (
        <View style={[styles.xpBadge, { backgroundColor: colors.card }]}>
          <ThemedText style={[styles.xpText, { color: colors.tint }]}>
            +{node.meta.xpReward} XP
          </ThemedText>
        </View>
      )}
    </AnimatedPressable>
  );
}

// ============================================
// CONNECTION LINES
// ============================================

interface ConnectionLinesProps {
  nodes: PathNode[];
  getScreenPosition: (node: PathNode) => { x: number; y: number };
}

function ConnectionLines({ nodes, getScreenPosition }: ConnectionLinesProps) {
  const colorScheme = useColorScheme();

  const lines = useMemo(() => {
    const result: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isCompleted: boolean;
    }[] = [];

    nodes.forEach((node) => {
      const fromPos = getScreenPosition(node);

      node.connections.forEach((connectedId) => {
        const toNode = nodes.find((n) => n.id === connectedId);
        if (toNode) {
          const toPos = getScreenPosition(toNode);
          result.push({
            key: `${node.id}-${connectedId}`,
            x1: fromPos.x,
            y1: fromPos.y,
            x2: toPos.x,
            y2: toPos.y,
            isCompleted: node.status === 'completed',
          });
        }
      });
    });

    return result;
  }, [nodes, getScreenPosition]);

  const mapHeight = Math.max(...nodes.map((n) => n.y)) * (nodes.length * NODE_SPACING) + PADDING * 2;
  const mapWidth = SCREEN_WIDTH;

  return (
    <Svg width={mapWidth} height={mapHeight} style={styles.linesContainer}>
      <Defs>
        <LinearGradient id="completedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#34C759" />
          <Stop offset="100%" stopColor="#248A3D" />
        </LinearGradient>
        <LinearGradient id="pendingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#C7C7CC" />
          <Stop offset="100%" stopColor="#E5E5EA" />
        </LinearGradient>
      </Defs>

      {lines.map((line) => (
        <Line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={line.isCompleted ? 'url(#completedGradient)' : 'url(#pendingGradient)'}
          strokeWidth={3}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function NodeMap({ path, onNodePress, height = 400 }: NodeMapProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Calculate screen positions from normalized coordinates
  const getScreenPosition = useCallback(
    (node: PathNode) => {
      const mapWidth = SCREEN_WIDTH - PADDING * 2;
      const mapHeight = path.nodes.length * NODE_SPACING;

      return {
        x: PADDING + node.x * mapWidth,
        y: PADDING + node.y * mapHeight,
      };
    },
    [path.nodes.length]
  );

  const contentHeight = path.nodes.length * NODE_SPACING + PADDING * 2;

  return (
    <Animated.ScrollView
      entering={FadeIn.duration(300)}
      style={[styles.container, { height, backgroundColor: colors.groupedBackground }]}
      contentContainerStyle={{ height: contentHeight }}
      showsVerticalScrollIndicator={false}
    >
      {/* Connection lines (rendered first, behind nodes) */}
      <ConnectionLines nodes={path.nodes} getScreenPosition={getScreenPosition} />

      {/* Nodes */}
      {path.nodes.map((node, index) => {
        const pos = getScreenPosition(node);
        return (
          <NodeComponent
            key={node.id}
            node={node}
            screenX={pos.x}
            screenY={pos.y}
            onPress={onNodePress}
            index={index}
          />
        );
      })}
    </Animated.ScrollView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  linesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  nodeContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: NODE_SIZE * 2,
  },
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressRing: {
    position: 'absolute',
    top: -4,
    left: NODE_SIZE / 2 - 4,
  },
  nodeLabel: {
    marginTop: Spacing.xs,
    alignItems: 'center',
    maxWidth: NODE_SIZE * 2,
  },
  nodeLabelText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  nodeSubtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  xpBadge: {
    position: 'absolute',
    top: -8,
    right: NODE_SIZE / 2 - 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  xpText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
