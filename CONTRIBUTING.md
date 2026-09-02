# Contributing to appcask

Thanks for taking a look. appcask is early — the shape of things can still
change, so an issue to discuss a direction before a large PR is welcome.

## Layout

```
packages/
  config/   @appcask/config  — the config JSON Schema, validator, resolver
  bridge/   @appcask/bridge  — the WebView <-> native wire protocol + codec
  router/   @appcask/router  — pure URL routing decisions for the shell
  web/      @appcask/web     — the window.appcask client for websites
  cli/      appcask          — the CLI (init, doctor, assets, android, build)
template/                    — the React Native shell the CLI materializes
docs/                        — the documentation site
examples/                    — sample configs
```

The `packages/*` are plain TypeScript, built with `tsc`, tested with Vitest.
`template/` is a React Native app and is **not** part of the pnpm workspace.

## Setup

```bash
pnpm install
pnpm -r --filter "./packages/*" build   # build once so cross-package imports resolve
pnpm -r test
```

## Before opening a PR

```bash
pnpm -r typecheck
pnpm lint
pnpm -r test
```

- Every behavioural change needs a test. The routing logic (`@appcask/router`)
  and the bridge codec (`@appcask/bridge`) are pure and should stay fully
  covered.
- `schema.json` is the source of truth for config shape. If you change it,
  update `packages/config/src/types.ts` and the tests that pin them together.
- The bridge protocol is documented in [`BRIDGE_PROTOCOL.md`](./BRIDGE_PROTOCOL.md).
  Adding a method is additive; changing the envelope is a version bump.
- Conventional Commit messages (`feat:`, `fix:`, `docs:`, …).

## Native code

Changes to `template/` should be tested on a real device or emulator, not just a
build. See `template/README.md`.

## Code of Conduct

By participating you agree to the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
