import { loadProject } from '../project.js';
import { dim, heading, info, line } from '../ui.js';

const PLANNED: Record<string, string[]> = {
  assets: [
    'Read assets/icon.png (1024²) and assets/splash-logo.png',
    'Generate Android mipmap-*/ic_launcher, adaptive-icon foreground/background, and Play Store icon',
    'Generate the iOS AppIcon.appiconset and splash imagesets',
    'Write a colors.xml / Contents.json wired to theme.splash.background',
  ],
  android: [
    'Materialize the React Native shell from template/ into ./android-app',
    'Patch applicationId, app name, versionName/versionCode, theme colours',
    'Write AndroidManifest intent-filters for features.deepLinks',
    'Wire google-services.json when features.push is set',
  ],
  ios: ['Materialize the shell into ./ios-app (Swift, ASWebAuthenticationSession) — arrives with the iOS milestone'],
  build: [
    'Run the Gradle assembleRelease / bundleRelease with your keystore',
    'Emit a signed APK and AAB next to the config',
  ],
  run: ['Build a debug APK and install it on the connected device / emulator (adb)'],
};

export async function stubCommand(name: string): Promise<void> {
  // Still load the project so the user gets config errors early.
  await loadProject().catch(() => undefined);
  heading(`appcask ${name}`);
  line(`  ${dim('Not implemented yet.')} This command will:`);
  line();
  for (const step of PLANNED[name] ?? ['(planned)']) info(step);
  line();
  line(`  ${dim('Follow https://github.com/appcask/appcask for progress.')}`);
}
