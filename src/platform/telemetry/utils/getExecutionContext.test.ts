import { fromPartial } from '@total-typescript/shoehorn'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeSourceType } from '@/types/nodeSource'

const hoisted = vi.hoisted(() => ({
  mockNodeDefsByName: {} as Partial<Record<string, Record<string, unknown>>>,
  mockNodes: [] as Pick<LGraphNode, 'type' | 'isSubgraphNode'>[]
}))

function mockNode(
  type: string,
  isSubgraph = false
): Pick<LGraphNode, 'type' | 'isSubgraphNode'> {
  return {
    type,
    isSubgraphNode: (() => isSubgraph) as LGraphNode['isSubgraphNode']
  }
}

vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  reduceAllNodes: vi.fn((_graph, reducer, initial) => {
    let result = initial
    for (const node of hoisted.mockNodes) {
      result = reducer(result, node)
    }
    return result
  })
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { rootGraph: {} }
}))

import { getExecutionContext } from './getExecutionContext'

beforeEach(() => {
  vi.mocked(useNodeDefStore().fromLGraphNode).mockImplementation(
    (node: Pick<LGraphNode, 'type'>) => {
      const nodeDef = hoisted.mockNodeDefsByName[node.type]
      return nodeDef
        ? fromPartial({
            nodeSource: { type: NodeSourceType.Unknown },
            ...nodeDef
          })
        : null
    }
  )
})

beforeEach(() => {
  vi.mocked(useWorkflowTemplatesStore().getTemplateByName).mockReturnValue(
    fromPartial({ sourceModule: 'default' })
  )
  vi.mocked(useWorkflowTemplatesStore().getEnglishMetadata).mockImplementation(
    () => null
  )
})

describe('getExecutionContext', () => {
  beforeEach(() => {
    hoisted.mockNodes.length = 0
    for (const key of Object.keys(hoisted.mockNodeDefsByName)) {
      delete hoisted.mockNodeDefsByName[key]
    }
  })

  it('returns has_toolkit_nodes false when no toolkit nodes are present', () => {
    hoisted.mockNodes.push(mockNode('KSampler'), mockNode('LoadImage'))
    hoisted.mockNodeDefsByName['KSampler'] = {
      name: 'KSampler',
      python_module: 'nodes'
    }
    hoisted.mockNodeDefsByName['LoadImage'] = {
      name: 'LoadImage',
      python_module: 'nodes'
    }

    const context = getExecutionContext()

    expect(context.has_toolkit_nodes).toBe(false)
    expect(context.toolkit_node_names).toEqual([])
    expect(context.toolkit_node_count).toBe(0)
  })

  it('detects individual toolkit nodes by type name', () => {
    hoisted.mockNodes.push(mockNode('Canny'), mockNode('KSampler'))
    hoisted.mockNodeDefsByName['Canny'] = {
      name: 'Canny',
      display_name: 'Canny'
    }
    hoisted.mockNodeDefsByName['KSampler'] = {
      name: 'KSampler',
      python_module: 'nodes'
    }

    const context = getExecutionContext()

    expect(context.has_toolkit_nodes).toBe(true)
    expect(context.toolkit_node_names).toEqual(['Canny'])
    expect(context.toolkit_node_count).toBe(1)
  })

  it('detects blueprint toolkit nodes via path', () => {
    const blueprintType = 'SubgraphBlueprint.Sharpen'
    hoisted.mockNodes.push(mockNode(blueprintType, true))
    hoisted.mockNodeDefsByName[blueprintType] = { name: blueprintType }

    const context = getExecutionContext()

    expect(context.has_toolkit_nodes).toBe(true)
    expect(context.toolkit_node_names).toEqual([blueprintType])
    expect(context.toolkit_node_count).toBe(1)
  })

  it('deduplicates toolkit_node_names when same type appears multiple times', () => {
    hoisted.mockNodes.push(mockNode('Canny'), mockNode('Canny'))
    hoisted.mockNodeDefsByName['Canny'] = {
      name: 'Canny',
      python_module: 'comfy_extras.nodes_canny'
    }

    const context = getExecutionContext()

    expect(context.toolkit_node_names).toEqual(['Canny'])
    expect(context.toolkit_node_count).toBe(2)
  })

  it('allows a node to appear in both api_node_names and toolkit_node_names', () => {
    hoisted.mockNodes.push(mockNode('RecraftRemoveBackgroundNode'))
    hoisted.mockNodeDefsByName['RecraftRemoveBackgroundNode'] = {
      name: 'RecraftRemoveBackgroundNode',
      python_module: 'comfy_extras.nodes_api',
      api_node: true
    }

    const context = getExecutionContext()

    expect(context.has_api_nodes).toBe(true)
    expect(context.api_node_names).toEqual(['RecraftRemoveBackgroundNode'])
    expect(context.has_toolkit_nodes).toBe(true)
    expect(context.toolkit_node_names).toEqual(['RecraftRemoveBackgroundNode'])
  })

  it('uses node.type as tracking name when nodeDef is missing', () => {
    hoisted.mockNodes.push(mockNode('ImageCropV2'))

    const context = getExecutionContext()

    expect(context.has_toolkit_nodes).toBe(true)
    expect(context.toolkit_node_names).toEqual(['ImageCropV2'])
  })

  describe('template detection', () => {
    it('detects a regular template by name', () => {
      Object.assign(useWorkflowTemplatesStore(), {
        knownTemplateNames: new Set(['flux-dev'])
      })
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'flux-dev',
        fullFilename: 'flux-dev.json'
      })

      const context = getExecutionContext()

      expect(context.is_template).toBe(true)
      expect(context.workflow_name).toBe('flux-dev')
    })

    it('detects an app mode template whose name ends with .app', () => {
      Object.assign(useWorkflowTemplatesStore(), {
        knownTemplateNames: new Set(['templates-qwen_multiangle.app'])
      })
      // getFilenameDetails strips ".app.json" as a compound extension, yielding
      // filename = "templates-qwen_multiangle" — the previous code would fail here.
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'templates-qwen_multiangle',
        fullFilename: 'templates-qwen_multiangle.app.json'
      })

      const context = getExecutionContext()

      expect(context.is_template).toBe(true)
      expect(context.workflow_name).toBe('templates-qwen_multiangle.app')
    })

    it('does not flag a non-template workflow as a template', () => {
      Object.assign(useWorkflowTemplatesStore(), {
        knownTemplateNames: new Set(['flux-dev'])
      })
      useWorkflowStore().activeWorkflow = fromPartial({
        filename: 'my-custom-workflow',
        fullFilename: 'my-custom-workflow.json'
      })

      const context = getExecutionContext()

      expect(context.is_template).toBe(false)
    })
  })
})
