# @appcask/config

The `appcask.config.json` schema, validator, and resolver.

```ts
import { validateConfig, resolveConfig } from '@appcask/config';

const { valid, problems } = validateConfig(json); // problems: [{ path, message }]
const config = resolveConfig(json);               // validates + fills every default
```

- `schema.json` — JSON Schema (draft 2020-12), the source of truth. Also exported as `@appcask/config/schema.json`.
- `validateConfig(data)` / `assertConfig(data)` — validate against the schema (ajv).
- `resolveConfig(data)` — validate, then apply defaults → `ResolvedAppcaskConfig`.
- `@appcask/config/defaults` → `applyDefaults(config)` — **pure**, no ajv / Node built-ins, safe to run in the React Native shell (the CLI has already validated at build time).

Derived defaults: `internalHosts` ← host of `startUrl`; `bridge.allowedOrigins` ← `https://<internalHost>`; `statusBar.style` ← `dark`; `safeArea` ← `css-vars`; `navigation.mode` ← `single`.
