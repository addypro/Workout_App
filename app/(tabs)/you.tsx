/**
 * You Tab
 *
 * Combined profile, settings, and achievements screen.
 * Part of the P0 UX redesign (4-tab layout).
 */

import React from 'react';
import { SwipeTabs } from '@/components/swipe-tabs';
import { SettingsContent } from '@/components/settings/settings-content';

export default function YouScreen() {
  return (
    <SwipeTabs current="you">
      <SettingsContent />
    </SwipeTabs>
  );
}
