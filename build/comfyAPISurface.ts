import path from 'path'

const COMFY_API_DIRS = ['extensions/core', 'scripts'] as const

export const COMFY_API_SOURCE_GLOBS = COMFY_API_DIRS.map(
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
