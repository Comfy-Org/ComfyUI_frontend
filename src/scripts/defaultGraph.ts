import type { ComfyWorkflowJSON } from '@/types/comfyWorkflow'

export const blankGraph: ComfyWorkflowJSON = {
  last_node_id: 0,
  last_link_id: 0,
  nodes: [],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

export const fetchDefaultGraph = async () => {
  try {
    const response = await fetch('/templates/default.json')
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    const graph = await response.json()
    return graph as ComfyWorkflowJSON
  } catch (_error) {
    console.warn('Failed to fetch default graph, using blank graph instead.')
    return blankGraph
  }
}
