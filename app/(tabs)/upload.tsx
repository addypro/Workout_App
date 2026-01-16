/**
 * Upload Redirect
 *
 * Legacy upload route kept for compatibility. Redirects to the main Import flow.
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/screen';
import { SwipeTabs } from '@/components/swipe-tabs';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function UploadRedirect() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    router.replace('/(tabs)/tools' as any);
  }, [router]);

  return (
    <SwipeTabs current="upload">
      <Screen>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </Screen>
    </SwipeTabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
});
