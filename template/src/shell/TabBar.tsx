import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NavigationTab } from '@appcask/config';
import { config } from '../config';

const ACTIVE = config.theme.statusBar.style === 'light' ? '#ffffff' : '#111111';
const BAR_BG = config.theme.navigationBarColor ?? config.theme.statusBar.color ?? '#000000';

/** Which tab best matches the current URL (longest matching prefix). */
export function activeTabIndex(tabs: NavigationTab[], currentUrl: string): number {
  let best = 0;
  let bestLen = -1;
  tabs.forEach((tab, i) => {
    if (currentUrl.startsWith(tab.url) && tab.url.length > bestLen) {
      best = i;
      bestLen = tab.url.length;
    }
  });
  return best;
}

export function TabBar({
  tabs,
  activeIndex,
  onSelect,
}: {
  tabs: NavigationTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
}): React.JSX.Element {
  return (
    <View style={[styles.bar, { backgroundColor: BAR_BG }]}>
      {tabs.map((tab, i) => {
        const active = i === activeIndex;
        return (
          <Pressable
            key={tab.url}
            style={styles.tab}
            onPress={() => onSelect(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {tab.icon ? (
              <Text style={[styles.icon, { color: ACTIVE, opacity: active ? 1 : 0.5 }]}>{tab.icon}</Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.label, { color: ACTIVE, opacity: active ? 1 : 0.5, fontWeight: active ? '700' : '500' }]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.3)',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 2 },
  icon: { fontSize: 18 },
  label: { fontSize: 11 },
});
