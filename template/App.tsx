/**
 * appcask shell entry point.
 *
 * This file is intentionally thin — all behaviour lives in src/shell. It reads
 * src/config.ts (from appcask.config.json) and renders the WebView host.
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { config } from './src/config';
import { WebShell } from './src/shell/WebShell';

function App(): React.JSX.Element {
  const barStyle = config.theme.statusBar.style === 'light' ? 'light-content' : 'dark-content';

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={config.theme.statusBar.color ?? undefined}
        translucent={false}
      />
      <WebShell />
    </SafeAreaProvider>
  );
}

export default App;
