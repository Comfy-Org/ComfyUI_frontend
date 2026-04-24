import type { Page } from '@playwright/test'

/**
 * Load a template by name into the current graph and return the count of
 * api-nodes in the resulting hierarchy. Counts via `node.constructor.nodeData`
 * — the same shape the pricing pipeline reads — and recurses into subgraph
 * containers so the count mirrors the production `reduceAllNodes` traversal.
 *
 * Used by dialog / indicator specs that need the real api-node count for
 * dynamic row assertions rather than hardcoded numbers that drift as the
 * template catalog evolves.
 */
export const loadTemplateIntoGraph = async (
  page: Page,
  templateName: string
): Promise<number> =>
  page.evaluate(async (name) => {
    const res = await fetch(`/templates/${name}.json`)
    if (!res.ok) throw new Error(`Failed to fetch template: ${name}`)
    const json = await res.json()
    await window.app!.loadGraphData(json, true, true, name, {
      openSource: 'template'
    })
    type NodeLike = {
      constructor?: { nodeData?: { api_node?: boolean } }
      isSubgraphNode?: () => boolean
      subgraph?: { nodes: NodeLike[] } | null
    }
    const countApiNodes = (graph: { nodes: NodeLike[] }): number =>
      graph.nodes.reduce((sum, node) => {
        const isApi = node.constructor?.nodeData?.api_node === true
        const subCount =
          node.isSubgraphNode?.() && node.subgraph
            ? countApiNodes(node.subgraph)
            : 0
        return sum + (isApi ? 1 : 0) + subCount
      }, 0)
    const rootGraph = window.app?.rootGraph
    if (!rootGraph) {
      throw new Error(
        `rootGraph unavailable after loading template ${name} — the fixture ` +
          `expected loadGraphData to populate app.rootGraph before returning.`
      )
    }
    return countApiNodes(rootGraph as unknown as { nodes: NodeLike[] })
  }, templateName)
