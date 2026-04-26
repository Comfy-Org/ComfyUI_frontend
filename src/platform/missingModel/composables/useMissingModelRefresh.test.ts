import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingModelCandidate } from '@/platform/missingModel/types'

const hoisted = vi.hoisted(() => ({
  app: {
    rootGraph: {},
    refreshComboInNodes: vi.fn()
  },
  missingModelStore: {
    missingModelCandidates: null as MissingModelCandidate[] | null,
    setMissingModels: vi.fn()
  },
  toastStore: {
    add: vi.fn()
  },
  activeWorkflow: null as {
    pendingWarnings: {
      missingModelCandidates?: MissingModelCandidate[]
      missingNodeTypes?: string[]
      missingMediaCandidates?: unknown[]
    } | null
  } | null,
  modelStore: {
    loadModelFolders: vi.fn(),
    getLoadedModelFolder: vi.fn()
  },
  node: {
    widgets: [
      {
        name: 'ckpt_name',
        type: 'combo',
        value: 'missing.safetensors',
        options: { values: [] as string[] }
      }
    ]
  },
  getNodeByExecutionId: vi.fn(),
  resolveComboValues: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: hoisted.app
}))

vi.mock('@/platform/missingModel/missingModelStore', () => ({
  useMissingModelStore: () => hoisted.missingModelStore
}))

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => hoisted.modelStore
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    workflow: {
      activeWorkflow: hoisted.activeWorkflow
    }
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => hoisted.toastStore
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: hoisted.getNodeByExecutionId
}))

vi.mock('@/utils/litegraphUtil', () => ({
  resolveComboValues: hoisted.resolveComboValues
}))

import { useMissingModelRefresh } from './useMissingModelRefresh'

function makeCandidate(
  overrides: Partial<MissingModelCandidate> = {}
): MissingModelCandidate {
  return {
    nodeId: '1',
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    isAssetSupported: false,
    name: 'missing.safetensors',
    directory: 'checkpoints',
    isMissing: true,
    ...overrides
  }
}

describe('useMissingModelRefresh', () => {
  beforeEach(() => {
    hoisted.app.rootGraph = {}
    hoisted.app.refreshComboInNodes.mockReset().mockResolvedValue(undefined)
    hoisted.missingModelStore.missingModelCandidates = [makeCandidate()]
    hoisted.missingModelStore.setMissingModels.mockReset()
    hoisted.toastStore.add.mockReset()
    hoisted.activeWorkflow = { pendingWarnings: null }
    hoisted.modelStore.loadModelFolders.mockReset().mockResolvedValue(undefined)
    hoisted.modelStore.getLoadedModelFolder.mockReset().mockResolvedValue({
      models: {}
    })
    hoisted.node.widgets[0].value = 'missing.safetensors'
    hoisted.node.widgets[0].options.values = []
    hoisted.getNodeByExecutionId.mockReset().mockReturnValue(hoisted.node)
    hoisted.resolveComboValues.mockReset().mockReturnValue([])
  })

  it('refreshes object info silently before checking candidates', async () => {
    const { refreshMissingModels } = useMissingModelRefresh()

    await refreshMissingModels()

    expect(hoisted.app.refreshComboInNodes).toHaveBeenCalledWith({
      silent: true
    })
    expect(hoisted.modelStore.loadModelFolders).toHaveBeenCalled()
  })

  it('removes a candidate when refreshed widget options contain the model', async () => {
    hoisted.resolveComboValues.mockReturnValue(['missing.safetensors'])

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([])
  })

  it('does not drop candidates added while refresh is in flight', async () => {
    const staleCandidate = makeCandidate({ name: 'stale.safetensors' })
    const newCandidate = makeCandidate({
      nodeId: '2',
      name: 'newly-added.safetensors'
    })
    hoisted.missingModelStore.missingModelCandidates = [staleCandidate]
    hoisted.resolveComboValues.mockReturnValue(['stale.safetensors'])
    hoisted.modelStore.loadModelFolders.mockImplementation(() => {
      hoisted.missingModelStore.missingModelCandidates = [
        staleCandidate,
        newCandidate
      ]
      return Promise.resolve()
    })

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([
      newCandidate
    ])
  })

  it('does not re-add candidates removed while refresh is in flight', async () => {
    const removedCandidate = makeCandidate({ name: 'removed.safetensors' })
    hoisted.missingModelStore.missingModelCandidates = [removedCandidate]
    hoisted.resolveComboValues.mockReturnValue(['removed.safetensors'])
    hoisted.modelStore.loadModelFolders.mockImplementation(() => {
      hoisted.missingModelStore.missingModelCandidates = null
      return Promise.resolve()
    })

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([])
  })

  it('syncs active workflow pending warnings after refreshing candidates', async () => {
    hoisted.resolveComboValues.mockReturnValue(['missing.safetensors'])
    hoisted.activeWorkflow!.pendingWarnings = {
      missingModelCandidates: [makeCandidate()],
      missingNodeTypes: ['MissingNode']
    }

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.activeWorkflow!.pendingWarnings).toEqual({
      missingModelCandidates: undefined,
      missingNodeTypes: ['MissingNode']
    })
  })

  it('clears active workflow pending warnings when no warnings remain', async () => {
    hoisted.resolveComboValues.mockReturnValue(['missing.safetensors'])
    hoisted.activeWorkflow = {
      pendingWarnings: {
        missingModelCandidates: [makeCandidate()],
        missingNodeTypes: [],
        missingMediaCandidates: []
      }
    }

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.activeWorkflow.pendingWarnings).toBeNull()
  })

  it('skips pending warning sync when there is no active workflow', async () => {
    hoisted.resolveComboValues.mockReturnValue(['missing.safetensors'])
    hoisted.activeWorkflow = null

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([])
  })

  it('removes a candidate when the refreshed model folder contains the model', async () => {
    hoisted.modelStore.getLoadedModelFolder.mockResolvedValue({
      models: {
        '0/missing.safetensors': { file_name: 'missing.safetensors' }
      }
    })

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([])
  })

  it('keeps a candidate when the selected value is still missing', async () => {
    const candidate = makeCandidate()
    hoisted.missingModelStore.missingModelCandidates = [candidate]

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).not.toHaveBeenCalled()
  })

  it('keeps workflow-level candidates unless their directory now contains the model', async () => {
    const candidate = makeCandidate({ nodeId: undefined, widgetName: '' })
    hoisted.missingModelStore.missingModelCandidates = [candidate]

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).not.toHaveBeenCalled()
  })

  it('returns early when there are no candidates', async () => {
    hoisted.missingModelStore.missingModelCandidates = null

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.app.refreshComboInNodes).not.toHaveBeenCalled()
    expect(hoisted.missingModelStore.setMissingModels).not.toHaveBeenCalled()
  })

  it('ignores a second refresh while one is already running', async () => {
    let resolveRefresh: () => void = () => {}
    hoisted.app.refreshComboInNodes.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRefresh = resolve
      })
    )

    const { refreshMissingModels } = useMissingModelRefresh()
    const firstRefresh = refreshMissingModels()
    const secondRefresh = refreshMissingModels()

    expect(hoisted.app.refreshComboInNodes).toHaveBeenCalledTimes(1)

    resolveRefresh()
    await Promise.all([firstRefresh, secondRefresh])

    expect(hoisted.missingModelStore.setMissingModels).not.toHaveBeenCalled()
  })

  it('shows a toast and keeps existing candidates when refresh fails', async () => {
    const candidate = makeCandidate()
    hoisted.missingModelStore.missingModelCandidates = [candidate]
    hoisted.app.refreshComboInNodes.mockRejectedValue(new Error('failed'))

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).not.toHaveBeenCalled()
    expect(hoisted.toastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'rightSidePanel.missingModels.refreshFailed'
    })
    expect(hoisted.toastStore.add).toHaveBeenCalledTimes(1)
  })

  it('still removes candidates fixed by object info when model folder refresh fails', async () => {
    hoisted.resolveComboValues.mockReturnValue(['missing.safetensors'])
    hoisted.modelStore.loadModelFolders.mockRejectedValue(new Error('failed'))

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([])
    expect(hoisted.toastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'rightSidePanel.missingModels.refreshPartiallyFailed'
    })
    expect(hoisted.toastStore.add).toHaveBeenCalledTimes(1)
  })

  it('removes resolved candidates and keeps failed candidates when folder checks are mixed', async () => {
    const resolvedCandidate = makeCandidate({
      name: 'resolved.safetensors',
      directory: 'checkpoints'
    })
    const failedCandidate = makeCandidate({
      nodeId: '2',
      name: 'failed.safetensors',
      directory: 'loras'
    })
    hoisted.missingModelStore.missingModelCandidates = [
      resolvedCandidate,
      failedCandidate
    ]
    hoisted.getNodeByExecutionId.mockImplementation((_, nodeId: string) => ({
      widgets: [
        {
          name: 'ckpt_name',
          type: 'combo',
          value: nodeId === '2' ? 'failed.safetensors' : 'resolved.safetensors',
          options: { values: [] }
        }
      ]
    }))
    hoisted.modelStore.getLoadedModelFolder.mockImplementation(
      (directory: string) => {
        if (directory === 'checkpoints') {
          return Promise.resolve({
            models: {
              '0/resolved.safetensors': { file_name: 'resolved.safetensors' }
            }
          })
        }
        return Promise.reject(new Error('failed'))
      }
    )

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    expect(hoisted.missingModelStore.setMissingModels).toHaveBeenCalledWith([
      failedCandidate
    ])
    expect(hoisted.toastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'rightSidePanel.missingModels.refreshPartiallyFailed'
    })
    expect(hoisted.toastStore.add).toHaveBeenCalledTimes(1)
  })

  it('does not show a stale error toast after a clean second refresh', async () => {
    hoisted.modelStore.getLoadedModelFolder.mockRejectedValueOnce(
      new Error('failed')
    )

    const { refreshMissingModels } = useMissingModelRefresh()
    await refreshMissingModels()

    hoisted.toastStore.add.mockReset()
    hoisted.modelStore.getLoadedModelFolder.mockResolvedValueOnce({
      models: {}
    })

    await refreshMissingModels()

    expect(hoisted.toastStore.add).not.toHaveBeenCalled()
  })
})
