import path from 'path'

/**
 * Directories under `src/` whose top-level exports form the generated
 * `window.comfyAPI` public API.
 *
 * `comfyAPIPlugin` rewrites every top-level export in these files into a
 * `window.comfyAPI.<module>.<name>` assignment and emits a sibling `.js` shim
 * that re-exports it, so third-party custom nodes can
 * `import { ClipspaceDialog } from '.../extensions/core/clipspace.js'`.
 *
 * The `export` keyword in these files is therefore load-bearing: an export with
 * no in-repo importer is still published API, not dead code. `knip.config.ts`
 * reads the same list to treat these files as entry points, so the build's
 * public surface and the dead-code analysis agree by construction instead of
 * needing a per-symbol escape hatch on each published-but-unimported export.
 */
const COMFY_API_DIRS = ['extensions/core', 'scripts'] as const

/** Knip `entry` patterns covering the generated public API surface. */
export const COMFY_API_ENTRY_GLOBS = COMFY_API_DIRS.map(
  (dir) => `src/${dir}/**/*.ts`
)

/**
 * The `src/`-relative path of a module transformed into `window.comfyAPI`
 * public API, or `null` if the module is not part of that surface.
 */
export function getComfyAPIRelativePath(id: string): string | null {
  if (!id.endsWith('.ts')) return null

  const relativePath = path
    .relative(path.join(process.cwd(), 'src'), id)
    .replace(/\\/g, '/')

  if (relativePath.startsWith('..')) return null

  return COMFY_API_DIRS.some((dir) => relativePath.startsWith(`${dir}/`))
    ? relativePath
    : null
}
