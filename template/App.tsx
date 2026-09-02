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
      {/* translucent so the WebView / SafeAreaView controls the status-bar strip
          colour consistently across Android versions (15+ forces edge-to-edge). */}
      <StatusBar barStyle={barStyle} translucent backgroundColor="transparent" />
      <WebShell />
    </SafeAreaProvider>
  );
}

export default App;
