import { loadProject } from '../project.js';
import { dim, heading, info, line } from '../ui.js';

const PLANNED: Record<string, string[]> = {
  ios: [
    'Materialize the shell into ./ios-app (Swift)',
    'ASWebAuthenticationSession for the OAuth handoff',
    'Universal Links + apple-app-site-association wiring',
  ],
  run: [
    'Build a debug APK, start Metro, install on the connected device / emulator (adb)',
    'For now: `appcask build android --debug` then `adb install`, with `npx react-native start` running',
  ],
};

export async function stubCommand(name: string): Promise<void> {
  await loadProject().catch(() => undefined);
  heading(`appcask ${name}`);
  line(`  ${dim('Not implemented yet.')} This command will:`);
  line();
  for (const step of PLANNED[name] ?? ['(planned)']) info(step);
  line();
  line(`  ${dim('Follow https://github.com/ATGFAIL/appcask for progress.')}`);
}
