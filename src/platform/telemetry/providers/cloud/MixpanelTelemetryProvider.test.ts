import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    watch: vi.fn()
  }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserResolved: vi.fn()
  })
}))

vi.mock('@/platform/telemetry/topupTracker', () => ({
  checkForCompletedTopup: vi.fn(),
  clearTopupTracking: vi.fn(),
  startTopupTracking: vi.fn()
}))

const hoisted = vi.hoisted(() => ({
  mockNodeDefsByName: {} as Record<string, unknown>,
  mockNodes: [] as Pick<LGraphNode, 'type' | 'isSubgraphNode'>[],
  mockActiveWorkflow: null as null | {
    filename: string
    fullFilename: string
  },
  mockKnownTemplateNames: new Set<string>(),
  mockTemplateByName: null as null | { sourceModule?: string }
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    nodeDefsByName: hoisted.mockNodeDefsByName
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return hoisted.mockActiveWorkflow
    }
  })
}))

vi.mock(
  '@/platform/workflow/templates/repositories/workflowTemplatesStore',
  () => ({
    useWorkflowTemplatesStore: () => ({
      get knownTemplateNames() {
        return hoisted.mockKnownTemplateNames
      },
      getTemplateByName: (_name: string) => hoisted.mockTemplateByName,
      getEnglishMetadata: () => null
    })
  })
)

function mockNode(
  type: string,
  isSubgraph = false
): Pick<LGraphNode, 'type' | 'isSubgraphNode'> {
  return {
    type,
    isSubgraphNode: (() => isSubgraph) as LGraphNode['isSubgraphNode']
  }
}

vi.mock('@/utils/graphTraversalUtil', () => ({
  reduceAllNodes: vi.fn((_graph, reducer, initial) => {
    let result = initial
    for (const node of hoisted.mockNodes) {
      result = reducer(result, node)
    }
    return result
  })
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
}))

vi.mock('@/platform/remoteConfig/remoteConfig', () => ({
  remoteConfig: { value: null }
}))

import { getExecutionContext } from '../../utils/getExecutionContext'

describe('getExecutionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.mockNodes.length = 0
    for (const key of Object.keys(hoisted.mockNodeDefsByName)) {
      delete hoisted.mockNodeDefsByName[key]
    }
    hoisted.mockActiveWorkflow = null
    hoisted.mockKnownTemplateNames = new Set()
    hoisted.mockTemplateByName = null
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
      python_module: 'comfy_extras.nodes_canny'
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

  it('detects blueprint toolkit nodes via python_module', () => {
    const blueprintType = 'SubgraphBlueprint.text_to_image'
    hoisted.mockNodes.push(mockNode(blueprintType, true))
    hoisted.mockNodeDefsByName[blueprintType] = {
      name: blueprintType,
      python_module: 'comfy_essentials'
    }

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
    hoisted.mockNodes.push(mockNode('ImageCrop'))

    const context = getExecutionContext()

    expect(context.has_toolkit_nodes).toBe(true)
    expect(context.toolkit_node_names).toEqual(['ImageCrop'])
  })

  describe('template detection', () => {
    it('detects a regular template by name', () => {
      hoisted.mockKnownTemplateNames = new Set(['flux-dev'])
      hoisted.mockTemplateByName = { sourceModule: 'default' }
      hoisted.mockActiveWorkflow = {
        filename: 'flux-dev',
        fullFilename: 'flux-dev.json'
      }

      const context = getExecutionContext()

      expect(context.is_template).toBe(true)
      expect(context.workflow_name).toBe('flux-dev')
    })

    it('detects an app mode template whose name ends with .app', () => {
      hoisted.mockKnownTemplateNames = new Set([
        'templates-qwen_multiangle.app'
      ])
      hoisted.mockTemplateByName = { sourceModule: 'default' }
      // getFilenameDetails strips ".app.json" as a compound extension, yielding
      // filename = "templates-qwen_multiangle" — the previous code would fail here.
      hoisted.mockActiveWorkflow = {
        filename: 'templates-qwen_multiangle',
        fullFilename: 'templates-qwen_multiangle.app.json'
      }

      const context = getExecutionContext()

      expect(context.is_template).toBe(true)
      expect(context.workflow_name).toBe('templates-qwen_multiangle.app')
    })

    it('does not flag a non-template workflow as a template', () => {
      hoisted.mockKnownTemplateNames = new Set(['flux-dev'])
      hoisted.mockActiveWorkflow = {
        filename: 'my-custom-workflow',
        fullFilename: 'my-custom-workflow.json'
      }

      const context = getExecutionContext()

      expect(context.is_template).toBe(false)
    })
  })
})
