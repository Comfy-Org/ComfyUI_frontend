import { fromPartial } from '@total-typescript/shoehorn'
import type { PartialDeep } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ExportedSubgraph,
  ExportedSubgraphInstance,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@/schemas/nodeDefSchema'

const mocks = vi.hoisted(() => ({
  addNodeDef: vi.fn(),
  createSubgraph: vi.fn((subgraph: unknown) => ({
    createdFrom: subgraph
  })),
  registerSubgraphNodeDef: vi.fn(),
  subgraphs: new Map<string, unknown>()
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    addNodeDef: mocks.addNodeDef
  })
}))

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      subgraphs: mocks.subgraphs,
      createSubgraph: mocks.createSubgraph
    }
  }
}))

vi.mock('./litegraphService', () => ({
  useLitegraphService: () => ({
    registerSubgraphNodeDef: mocks.registerSubgraphNodeDef
  })
}))

const { useSubgraphService } = await import('./subgraphService')

function createExportedSubgraph(
  overrides: Partial<ExportedSubgraph> = {}
): ExportedSubgraph {
  return createTestSubgraphData({
    id: 'subgraph-1',
    name: 'Test Subgraph',
    ...overrides
  })
}

function createWorkflow(subgraphs?: ExportedSubgraph[]): ComfyWorkflowJSON {
  return fromPartial<ComfyWorkflowJSON>({
    definitions: subgraphs
      ? {
          subgraphs
        }
      : undefined
  } as PartialDeep<ComfyWorkflowJSON>)
}

describe('useSubgraphService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.subgraphs.clear()
  })

  it('registers a new subgraph node definition', () => {
    const service = useSubgraphService()
    const subgraph = fromPartial<Subgraph>({ id: 'runtime-subgraph' })
    const exportedSubgraph = createExportedSubgraph()

    service.registerNewSubgraph(subgraph, exportedSubgraph)

    expect(mocks.addNodeDef).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'subgraph-1',
        display_name: 'Test Subgraph',
        description: 'Subgraph node for Test Subgraph',
        category: 'subgraph',
        output_node: false,
        python_module: 'nodes'
      })
    )

    const [nodeDef, registeredSubgraph, instanceData] = mocks
      .registerSubgraphNodeDef.mock.calls[0] as [
      ComfyNodeDefV1,
      Subgraph,
      ExportedSubgraphInstance
    ]

    expect(nodeDef.name).toBe('subgraph-1')
    expect(registeredSubgraph).toBe(subgraph)
    expect(instanceData).toMatchObject({
      id: -1,
      type: 'subgraph-1',
      pos: [0, 0],
      size: [100, 100],
      inputs: [],
      outputs: []
    })
  })

  it('uses an exported description when present', () => {
    const service = useSubgraphService()
    const subgraph = fromPartial<Subgraph>({ id: 'runtime-subgraph' })

    service.registerNewSubgraph(
      subgraph,
      createExportedSubgraph({
        description: 'Reusable workflow section'
      })
    )

    expect(mocks.addNodeDef).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Reusable workflow section'
      })
    )
  })

  it('does nothing when workflow data has no subgraph definitions', () => {
    const service = useSubgraphService()

    service.loadSubgraphs(createWorkflow())

    expect(mocks.addNodeDef).not.toHaveBeenCalled()
    expect(mocks.registerSubgraphNodeDef).not.toHaveBeenCalled()
  })

  it('registers existing root graph subgraphs from workflow data', () => {
    const service = useSubgraphService()
    const subgraph = fromPartial<Subgraph>({ id: 'existing-subgraph' })
    const exportedSubgraph = createExportedSubgraph()
    mocks.subgraphs.set('subgraph-1', subgraph)

    service.loadSubgraphs(createWorkflow([exportedSubgraph]))

    expect(mocks.createSubgraph).not.toHaveBeenCalled()
    expect(mocks.registerSubgraphNodeDef).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'subgraph-1'
      }),
      subgraph,
      expect.objectContaining({
        type: 'subgraph-1'
      })
    )
  })

  it('creates missing root graph subgraphs from workflow data', () => {
    const service = useSubgraphService()
    const exportedSubgraph = createExportedSubgraph()

    service.loadSubgraphs(createWorkflow([exportedSubgraph]))

    expect(mocks.createSubgraph).toHaveBeenCalledWith(exportedSubgraph)
    expect(mocks.registerSubgraphNodeDef).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'subgraph-1'
      }),
      expect.objectContaining({
        createdFrom: exportedSubgraph
      }),
      expect.objectContaining({
        type: 'subgraph-1'
      })
    )
  })
})
