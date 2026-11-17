import { messages } from './messages'
import type { HostNode } from './pointHost'

/** What her card offers on top of the field, for what is selected right now. */
export interface CardOptions {
  /** What the options are about, shown as a line of its own; null for the workflow as a whole. */
  context: string | null
  /** The question that fits best: the big row. */
  lead: string
  /** Up to two more, as quiet links. */
  more: string[]
  placeholder: string
}

const MORE_AT_MOST = 2
const NAMED_AT_MOST = 2

function hasSetting(node: HostNode, name: string): boolean {
  return node.settings.some((setting) => setting.name === name)
}

/** Changes the workflow can offer, in the order they are listed, for these nodes. */
function changesFor(nodes: readonly HostNode[]): string[] {
  const changes: string[] = []
  if (nodes.some((node) => hasSetting(node, 'steps')))
    changes.push(messages.card.faster)
  if (
    nodes.some(
      (node) => hasSetting(node, 'width') && hasSetting(node, 'height')
    )
  )
    changes.push(messages.card.larger)
  return changes
}

/** The node a newcomer should meet first: the sampler (it has `steps`), else the one with the most settings. */
function keyNodeOf(nodes: readonly HostNode[]): HostNode | undefined {
  const withSettings = nodes.filter((node) => node.settings.length > 0)
  return (
    withSettings.find((node) => hasSetting(node, 'steps')) ??
    withSettings.reduce<HostNode | undefined>(
      (best, node) =>
        !best || node.settings.length > best.settings.length ? node : best,
      undefined
    )
  )
}

function contextOf(selected: readonly HostNode[]): string {
  return selected.length <= NAMED_AT_MOST
    ? selected.map((node) => node.title).join(' + ')
    : messages.card.manyNodes(selected.length)
}

/**
 * Options that follow the selection: a lead question and up to two more,
 * from what the selected nodes are (or, with none selected, what the
 * workflow has). A fixed table, not written by the model.
 */
export function cardOptions(
  nodes: readonly HostNode[],
  selection: readonly string[]
): CardOptions {
  if (nodes.length === 0)
    return {
      context: null,
      lead: messages.card.start,
      more: [messages.card.canDo],
      placeholder: messages.card.placeholderEmpty
    }

  const selected = nodes.filter((node) => selection.includes(node.id))
  if (selected.length === 0) {
    const key = keyNodeOf(nodes)
    return {
      context: null,
      lead: messages.card.explain,
      more: [
        ...(key ? [messages.card.whatNamedDoes(key.title)] : []),
        ...changesFor(nodes)
      ].slice(0, MORE_AT_MOST),
      placeholder: messages.card.placeholderWorkflow
    }
  }
  if (selected.length > 1)
    return {
      context: contextOf(selected),
      lead: messages.card.theseConnected,
      more: [messages.card.eachOne],
      placeholder: messages.card.placeholderNodes
    }

  const [only] = selected
  const connected =
    only.links.length > 0 ||
    nodes.some((node) => node.links.some((link) => link.from === only.id))
  const more = [
    ...changesFor([only]),
    ...(only.settings.length > 0 ? [messages.card.settings] : []),
    ...(connected ? [messages.card.connected] : [])
  ]
  return {
    context: only.title,
    lead: messages.card.whatThisDoes,
    more: more.slice(0, MORE_AT_MOST),
    placeholder: messages.card.placeholderNode(only.title)
  }
}
