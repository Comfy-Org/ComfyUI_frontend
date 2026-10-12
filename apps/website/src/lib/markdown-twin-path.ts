/** `/` → `/index.md`, `/api` and `/api/` → `/api.md`, `/zh-CN/cli/` → `/zh-CN/cli.md`. */
export function markdownTwinPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  if (trimmed === '') return '/index.md'
  if (trimmed.endsWith('.md')) return trimmed
  return `${trimmed}.md`
}
