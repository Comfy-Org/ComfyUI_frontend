import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Every `.html` file under `dir`, recursively. Throws when `dir` is missing. */
export function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return htmlFiles(full)
    return entry.name.endsWith('.html') ? [full] : []
  })
}

/** `<root>/zh-CN/about/index.html` -> `/zh-CN/about/` */
export function routeOf(root: string, file: string): string {
  const rel = relative(root, file).split(sep).join('/')
  const withoutIndex = rel.replace(/index\.html$/, '')
  return `/${withoutIndex}`.replace(/\/{2,}/g, '/')
}

/**
 * Whether `path` (`/zh-CN/cli.md`) names a file under `root` with this exact
 * case. `existsSync` ignores case on macOS and Windows; the Linux CI and the
 * CDN do not.
 */
export function isFileWithExactCase(root: string, path: string): boolean {
  const segments = path.split('/').filter(Boolean)
  return (
    segments.length > 0 &&
    segments.every((segment, index) => {
      const entry = readdirSync(join(root, ...segments.slice(0, index)), {
        withFileTypes: true
      }).find(({ name }) => name === segment)
      return index === segments.length - 1
        ? entry?.isFile() === true
        : entry?.isDirectory() === true
    })
  )
}
