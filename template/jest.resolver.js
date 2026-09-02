/**
 * The @appcask/* packages are authored in TypeScript with NodeNext-style `.js`
 * import specifiers. When Jest is pointed at their `src/`, a request for
 * `./foo.js` needs to resolve to `./foo.ts`. Fall back to that; otherwise defer
 * to Jest's default resolver.
 */
module.exports = (request, options) => {
  if (request.startsWith('.') && request.endsWith('.js')) {
    try {
      return options.defaultResolver(request.replace(/\.js$/, '.ts'), options);
    } catch {
      // fall through to the normal resolution below
    }
  }
  return options.defaultResolver(request, options);
};
