import type { LGraph, Subgraph } from '@/lib/litegraph/src/litegraph'
import { formatDate } from '@/utils/formatUtil'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

export function applyTextReplacements(
  graph: LGraph | Subgraph,
  value: string
): string {
  const allNodes = collectAllNodes(graph)

  return value.replace(/%([^%]+)%/g, function (match, text) {
    const isDate = text.startsWith('date:')
    const fallbackReplacement = isDate
      ? formatDate(text.substring(5), new Date())
      : match

    const split = text.split('.')
    if (split.length !== 2) {
      if (!isDate && text !== 'width' && text !== 'height') {
        console.warn('Invalid replacement pattern', text)
      }
      return fallbackReplacement
    }

    let nodes = allNodes.filter(
      (n) => n.properties['Node name for S&R'] === split[0]
    )
    if (!nodes.length) {
      nodes = allNodes.filter((n) => n.title === split[0])
    }
    if (!nodes.length) {
      if (!isDate) console.warn('Unable to find node', split[0])
      return fallbackReplacement
    }

    if (nodes.length > 1) {
      console.warn('Multiple nodes matched', split[0], 'using first match')
    }

    const node = nodes[0]

    const widget = node.widgets?.find((w) => w.name === split[1])
    if (!widget) {
      console.warn('Unable to find widget', split[1], 'on node', split[0], node)
      return match
    }

    return ((widget.value ?? '') + '').replaceAll(
      // oxlint-disable-next-line no-control-regex
      /[/?<>\\:*|"\x00-\x1F\x7F]/g,
      '_'
    )
  })
}
