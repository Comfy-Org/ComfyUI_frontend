import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const repoSrc = resolve(repoRoot, 'src')
const surfaceRoot = resolve(repoSrc, 'extension-api')

/**
 * Library build for `@comfyorg/extension-api`.
 *
 * Per ADR D17 (PKG2 build strategy), the package is built from the canonical
 * surface defined in the main app at `src/extension-api/index.ts`. Vite
 * resolves the `@/*` aliases against the main app's `src/` directory and
 * emits a single bundled `index.js` plus a single bundled `index.d.ts`.
 *
 * The package barrel at `packages/extension-api/src/index.ts` is the
 * Vite entry point and re-exports `@/extension-api/index` — preserving
 * "the barrel is the source of truth in main app `src/extension-api/`"
 * intent in `packages/extension-api/AGENTS.md`.
 *
 * Vue is externalized as a peer dependency (per D6.1 Phase A — extension
 * authors share the host app's Vue runtime).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@/utils/formatUtil': resolve(
        repoRoot,
        'packages/shared-frontend-utils/src/formatUtil.ts'
      ),
      '@/utils/networkUtil': resolve(
        repoRoot,
        'packages/shared-frontend-utils/src/networkUtil.ts'
      ),
      '@': repoSrc
    }
  },
  build: {
    outDir: resolve(here, 'build'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    minify: false,
    lib: {
      // Build directly from the canonical surface in the main app — the
      // package's own `src/index.ts` exists only as a documented entry
      // point that re-exports the same surface, but we point Vite at the
      // canonical file so dts paths line up cleanly with the JS bundle.
      entry: resolve(surfaceRoot, 'index.ts'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      // Vue is provided by the host app at runtime.
      external: ['vue', /^@vue\//]
    }
  },
  plugins: [
    dts({
      // entryRoot = the main app `src/` so the surface entry lands at
      // `build/extension-api/index.d.ts` and its transitive type-chain
      // (`@/services/*`, `@/types/*`, `@/world/*`) is emitted at the
      // matching subdirectories under build/. The package.json `types`
      // field points at `build/extension-api/index.d.ts` to match.
      // vite-plugin-dts rewrites `@/*` aliases to relative paths so the
      // emitted tree resolves without runtime alias support.
      entryRoot: repoSrc,
      outDir: resolve(here, 'build'),
      tsconfigPath: resolve(here, 'tsconfig.build.json'),
      // Pre-existing main app type warnings (inferred type portability,
      // augmentation timing) are out-of-scope for this build per D17.
      // Emit declarations even when the underlying type-check has soft
      // warnings; the surface itself is well-formed and the runtime
      // contract is verified by the bundled JS smoke test.
      logLevel: 'warn',
      // Emit the transitive type chain that the surface references via
      // `@/services/*`, `@/types/*`, `@/world/*`, `@/platform/*`, and
      // `@/lib/litegraph/*`. The dts plugin rewrites `@/*` imports to
      // relative paths under build/, so emitting the closure keeps every
      // `import { … } from '../…'` resolvable. The tsconfig.build.json
      // `include` defines what TS sees; this list mirrors it.
      include: [resolve(repoSrc, '**/*.ts')],
      exclude: [
        resolve(repoSrc, '**/*.test.ts'),
        resolve(repoSrc, '**/*.spec.ts'),
        resolve(repoSrc, '**/*.vue')
      ]
    })
  ]
})
