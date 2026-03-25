import {
  TOOLKIT_BLUEPRINT_MODULES,
  TOOLKIT_NODE_NAMES
} from '@/constants/toolkitNodes'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { app } from '@/scripts/app'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeSourceType } from '@/types/nodeSource'
import { reduceAllNodes } from '@/utils/graphTraversalUtil'

import type { ExecutionContext } from '../types'

type NodeMetrics = {
  custom_node_count: number
  api_node_count: number
  toolkit_node_count: number
  subgraph_count: number
  total_node_count: number
  has_api_nodes: boolean
  api_node_names: string[]
  has_toolkit_nodes: boolean
  toolkit_node_names: string[]
}

export function getExecutionContext(): ExecutionContext {
  const workflowStore = useWorkflowStore()
  const templatesStore = useWorkflowTemplatesStore()
  const nodeDefStore = useNodeDefStore()
  const activeWorkflow = workflowStore.activeWorkflow

  const nodeCounts = reduceAllNodes<NodeMetrics>(
    app.rootGraph,
    (metrics, node) => {
      const nodeDef = nodeDefStore.nodeDefsByName[node.type]
      const isCustomNode =
        nodeDef?.nodeSource?.type === NodeSourceType.CustomNodes
      const isApiNode = nodeDef?.api_node === true
      const isSubgraph = node.isSubgraphNode?.() === true

      if (isApiNode) {
        metrics.has_api_nodes = true
        const canonicalName = nodeDef?.name
        if (canonicalName && !metrics.api_node_names.includes(canonicalName)) {
          metrics.api_node_names.push(canonicalName)
        }
      }

      const isToolkitNode =
        TOOLKIT_NODE_NAMES.has(node.type) ||
        (nodeDef?.python_module !== undefined &&
          TOOLKIT_BLUEPRINT_MODULES.has(nodeDef.python_module))
      if (isToolkitNode) {
        metrics.has_toolkit_nodes = true
        const trackingName = nodeDef?.name ?? node.type
        if (!metrics.toolkit_node_names.includes(trackingName)) {
          metrics.toolkit_node_names.push(trackingName)
        }
      }

      metrics.custom_node_count += isCustomNode ? 1 : 0
      metrics.api_node_count += isApiNode ? 1 : 0
      metrics.toolkit_node_count += isToolkitNode ? 1 : 0
      metrics.subgraph_count += isSubgraph ? 1 : 0
      metrics.total_node_count += 1

      return metrics
    },
    {
      custom_node_count: 0,
      api_node_count: 0,
      toolkit_node_count: 0,
      subgraph_count: 0,
      total_node_count: 0,
      has_api_nodes: false,
      api_node_names: [],
      has_toolkit_nodes: false,
      toolkit_node_names: []
    }
  )

  if (activeWorkflow?.filename) {
    const isTemplate = templatesStore.knownTemplateNames.has(
      activeWorkflow.filename
    )

    if (isTemplate) {
      const template = templatesStore.getTemplateByName(activeWorkflow.filename)

      const englishMetadata = templatesStore.getEnglishMetadata(
        activeWorkflow.filename
      )

      return {
        is_template: true,
        workflow_name: activeWorkflow.filename,
        template_source: template?.sourceModule,
        template_category: englishMetadata?.category ?? template?.category,
        template_tags: englishMetadata?.tags ?? template?.tags,
        template_models: englishMetadata?.models ?? template?.models,
        template_use_case: englishMetadata?.useCase ?? template?.useCase,
        template_license: englishMetadata?.license ?? template?.license,
        ...nodeCounts
      }
    }

    return {
      is_template: false,
      workflow_name: activeWorkflow.filename,
      ...nodeCounts
    }
  }

  return {
    is_template: false,
    workflow_name: undefined,
    ...nodeCounts
  }
}
