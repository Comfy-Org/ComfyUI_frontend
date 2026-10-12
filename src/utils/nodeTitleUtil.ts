import { resolveNodeDefText } from '@/i18n'

type NodeTitleInfo = {
  title?: string | number | null
  type?: string | number | null
}

type ResolveNodeDisplayNameOptions = {
  emptyLabel: string
  untitledLabel: string
}

export function resolveNodeDisplayName(
  node: NodeTitleInfo | null | undefined,
  options: ResolveNodeDisplayNameOptions
): string {
  if (!node) return options.emptyLabel

  const title = (node.title ?? '').toString().trim()
  if (title.length > 0) return title

  const nodeType = (node.type ?? '').toString().trim() || options.untitledLabel
  return resolveNodeDefText('display_name', nodeType)
}
