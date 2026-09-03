/**
 * Directories whose top-level exports form the generated `window.comfyAPI`
 * public API.
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
const COMFY_API_DIRS = ['src/extensions/core', 'src/scripts'] as const

/** Knip `entry` patterns covering the generated public API surface. */
export const COMFY_API_ENTRY_GLOBS = COMFY_API_DIRS.map(
  (dir) => `${dir}/**/*.ts`
)

/** Whether a module id is transformed into `window.comfyAPI` public API. */
export function isComfyAPISourceFile(id: string): boolean {
  return id.endsWith('.ts') && COMFY_API_DIRS.some((dir) => id.includes(dir))
}
