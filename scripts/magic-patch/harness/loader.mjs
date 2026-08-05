/**
 * Module-resolution hook that lets a real pack load outside ComfyUI.
 *
 * Packs import four host modules by relative path (`../../scripts/app.js` and
 * friends, 8,600 sites across the corpus) and converted packs import
 * `/comfy/api/v1.js` by absolute path. Neither resolves on disk here, so
 * without this the pack cannot be loaded at all — which is why the `loads`,
 * `registers-no-fewer-types` and wire checks have been skipping.
 *
 * A resolve hook is used rather than materialising stub files next to the pack
 * because the depth of `../../` varies per file, and because the stubs must be
 * the *same* module instances the harness inspects afterwards.
 */
const HOST_MODULES = {
  '/comfy/api/v1.js': 'comfyApi',
  // Not a pack import: litegraph reaches i18n via BaseWidget, and `src/i18n.ts`
  // uses Vite's `import.meta.glob`, which throws under plain Node.
  '@/i18n': 'i18n',
  'src/i18n.ts': 'i18n',
  'scripts/app.js': 'app',
  'scripts/api.js': 'api',
  'scripts/widgets.js': 'widgets',
  'scripts/ui.js': 'ui'
}

export function resolve(specifier, context, nextResolve) {
  for (const [suffix, stub] of Object.entries(HOST_MODULES)) {
    if (specifier === suffix || specifier.endsWith(suffix)) {
      return {
        url: new URL(`./stubs/${stub}.mjs`, import.meta.url).href,
        shortCircuit: true
      }
    }
  }
  return nextResolve(specifier, context)
}
