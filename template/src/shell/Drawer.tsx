import React, { useCallback, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationTab } from '@appcask/config';
import { config } from '../config';

const PANEL_W = Math.min(320, Dimensions.get('window').width * 0.8);
const DARK = config.theme.statusBar.style === 'light';
const PANEL_BG = config.theme.navigationBarColor ?? config.theme.statusBar.color ?? (DARK ? '#111114' : '#ffffff');
const FG = DARK ? '#ffffff' : '#111111';

/**
 * A slide-out drawer (navigation.mode "drawer"). A small button overlays the
 * top-left of the WebView; tapping it slides in a panel of `navigation.tabs`.
 */
export function Drawer({
  items,
  onSelect,
}: {
  items: NavigationTab[];
  onSelect: (url: string) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const x = useRef(new Animated.Value(-PANEL_W)).current;
  const dim = useRef(new Animated.Value(0)).current;

  const animate = useCallback(
    (toOpen: boolean) => {
      setOpen(toOpen);
      Animated.parallel([
        Animated.timing(x, {
          toValue: toOpen ? 0 : -PANEL_W,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dim, { toValue: toOpen ? 1 : 0, duration: 220, useNativeDriver: true }),
      ]).start();
    },
    [x, dim],
  );

  return (
    <>
      <Pressable
        onPress={() => animate(true)}
        style={[styles.button, { top: insets.top + 6, backgroundColor: PANEL_BG }]}
        accessibilityLabel="Open menu"
      >
        <View style={[styles.line, { backgroundColor: FG }]} />
        <View style={[styles.line, { backgroundColor: FG }]} />
        <View style={[styles.line, { backgroundColor: FG }]} />
      </Pressable>

      {open ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: dim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => animate(false)} />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.panel,
          { width: PANEL_W, backgroundColor: PANEL_BG, paddingTop: insets.top + 16, transform: [{ translateX: x }] },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Text style={[styles.heading, { color: FG }]}>{config.identity.appName}</Text>
        {items.map((item) => (
          <Pressable
            key={item.url}
            style={styles.item}
            onPress={() => {
              animate(false);
              onSelect(item.url);
            }}
          >
            {item.icon ? <Text style={[styles.itemIcon, { color: FG }]}>{item.icon}</Text> : null}
            <Text style={[styles.itemLabel, { color: FG }]}>{item.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 10,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    opacity: 0.92,
  },
  line: { width: 16, height: 2, borderRadius: 1 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 20 },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 18,
  },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  itemIcon: { fontSize: 18 },
  itemLabel: { fontSize: 16, fontWeight: '500' },
});
