import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { config } from '../config';

interface Props {
  onRetry?: () => void;
  title?: string;
  body?: string;
  actionLabel?: string;
}

/** The built-in full-screen message — offline, maintenance, or "please update". */
export function OfflineScreen({ onRetry, title, body, actionLabel }: Props): React.JSX.Element {
  const bg = config.theme.splash?.background ?? config.theme.statusBar.color ?? '#ffffff';
  const dark = isDark(bg);
  const fg = dark ? '#ffffff' : '#111111';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.title, { color: fg }]}>{title ?? "You're offline"}</Text>
      <Text style={[styles.body, { color: fg, opacity: 0.7 }]}>
        {body ?? `${config.identity.appName} needs a connection to load.`}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.button, { borderColor: fg, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: fg }]}>{actionLabel ?? 'Try again'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function isDark(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m || !m[1]) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
