/**
 * Coach Index
 *
 * Redirects to the coach tab (dashboard moved to tabs).
 */

import { Redirect } from 'expo-router';

export default function CoachIndex() {
  return <Redirect href={'/(tabs)/coach' as any} />;
}
