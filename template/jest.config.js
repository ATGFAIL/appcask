/**
 * The @appcask/* packages are linked via `file:`. Point Jest at their
 * TypeScript sources and let babel-jest transform them like the app's own code.
 * `jest.resolver.js` handles their NodeNext-style `.js` import specifiers.
 * Only the dependency-free entrypoints are mapped — the shell never imports the
 * ajv-backed `@appcask/config` root.
 */
const path = require('path');
const src = (p) => path.resolve(__dirname, '..', 'packages', p);

module.exports = {
  preset: 'react-native',
  resolver: '<rootDir>/jest.resolver.js',
  moduleNameMapper: {
    // The @appcask sources live outside template/node_modules; make sure Babel's
    // injected runtime helpers still resolve to the copy installed here.
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    '^@appcask/bridge$': src('bridge/src/index.ts'),
    '^@appcask/router$': src('router/src/index.ts'),
    '^@appcask/config/defaults$': src('config/src/defaults.ts'),
    '^@appcask/config$': src('config/src/types.ts'),
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-webview|react-native-url-polyfill)/)',
    '/packages/(?!(bridge|router|config)/src/)',
  ],
};
