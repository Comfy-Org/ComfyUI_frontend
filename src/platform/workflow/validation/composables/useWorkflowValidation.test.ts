import { LinkRepairAbortedError } from '@comfyorg/workflow-validation'
import type {
  ComfyWorkflowJSON,
  RepairResult,
  TopologyError
} from '@comfyorg/workflow-validation'
import type * as WorkflowValidationModule from '@comfyorg/workflow-validation'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowValidation } from './useWorkflowValidation'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  createI18n: () => ({ global: { t: (key: string) => key } })
}))

const toastAddMock = vi.hoisted(() => vi.fn())
const toastAddAlertMock = vi.hoisted(() => vi.fn())

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: toastAddMock,
    addAlert: toastAddAlertMock
  })
}))

const validateLinkTopologyMock = vi.hoisted(() => vi.fn())
const repairLinksMock = vi.hoisted(() => vi.fn())

vi.mock('@comfyorg/workflow-validation', async () => {
  const actual = await vi.importActual<typeof WorkflowValidationModule>(
    '@comfyorg/workflow-validation'
  )
  return {
    ...actual,
    validateLinkTopology: validateLinkTopologyMock,
    repairLinks: repairLinksMock
  }
})

const validateComfyWorkflowMock = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/validation/schemas/workflowSchema', () => ({
  validateComfyWorkflow: validateComfyWorkflowMock
}))

function makeLink(linkId: number) {
  return {
    linkId,
    originId: 1,
    originSlot: 0,
    targetId: 2,
    targetSlot: 0
  }
}

function makeWorkflow(): ComfyWorkflowJSON {
  return {
    version: 0.4,
    last_node_id: 2,
    last_link_id: 1,
    nodes: [
      { id: 1, outputs: [{ name: 'o', type: '*', links: [1] }] },
      { id: 2, inputs: [{ name: 'i', type: '*', link: 1 }] }
    ] as unknown as ComfyWorkflowJSON['nodes'],
    links: [[1, 1, 0, 2, 0, '*']] as unknown as ComfyWorkflowJSON['links']
  } as ComfyWorkflowJSON
}

function repairResult(
  graph: ComfyWorkflowJSON,
  overrides: Partial<RepairResult> = {}
): RepairResult {
  return {
    graph: graph as unknown as RepairResult['graph'],
    hasBadLinks: false,
    fixed: false,
    patched: 0,
    deleted: 0,
    ...overrides
  }
}

describe('useWorkflowValidation', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  afterEach(() => vi.restoreAllMocks())

  it('returns null when schema validation fails', async () => {
    validateComfyWorkflowMock.mockImplementation(async (_d, onError) => {
      onError('bad schema')
      return null
    })

    const { validateWorkflow } = useWorkflowValidation()
    const out = await validateWorkflow(makeWorkflow())

    expect(out.graphData).toBeNull()
    expect(toastAddAlertMock).toHaveBeenCalledWith('bad schema')
    expect(repairLinksMock).not.toHaveBeenCalled()
  })

  it('passes through when schema validation succeeds and no topology errors exist', async () => {
    const wf = makeWorkflow()
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([])
    repairLinksMock.mockImplementation((g) => repairResult(g))

    const { validateWorkflow } = useWorkflowValidation()
    const out = await validateWorkflow(wf)

    expect(out.graphData).not.toBeNull()
    expect(toastAddMock).not.toHaveBeenCalled()
  })

  it('emits a single warn toast summarising up to TOPOLOGY_TOAST_LIMIT errors', async () => {
    const wf = makeWorkflow()
    const errors: TopologyError[] = Array.from({ length: 7 }, (_v, i) => ({
      kind: 'missing-origin-node',
      link: makeLink(i + 1)
    }))
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue(errors)
    repairLinksMock.mockImplementation((g) => repairResult(g))

    const { validateWorkflow } = useWorkflowValidation()
    await validateWorkflow(wf)

    const warns = toastAddMock.mock.calls.filter(
      ([arg]) => (arg as { severity: string }).severity === 'warn'
    )
    expect(warns).toHaveLength(1)
    const detail = (warns[0]![0] as { detail: string }).detail
    expect(detail.split('\n')).toHaveLength(6)
  })

  it('shows the success toast when repair fixes links', async () => {
    const wf = makeWorkflow()
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([])
    repairLinksMock.mockImplementation((g) =>
      repairResult(g, { fixed: true, patched: 2, deleted: 1 })
    )

    const { validateWorkflow } = useWorkflowValidation()
    await validateWorkflow(wf)

    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('returns null and emits an error toast on LinkRepairAbortedError', async () => {
    const wf = makeWorkflow()
    const topologyError: TopologyError = {
      kind: 'target-slot-out-of-bounds',
      link: makeLink(7),
      targetSlotCount: 5
    }
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([topologyError])
    repairLinksMock.mockImplementation(() => {
      throw new LinkRepairAbortedError(topologyError)
    })

    const { validateWorkflow } = useWorkflowValidation()
    const out = await validateWorkflow(wf)

    expect(out.graphData).toBeNull()
    expect(toastAddMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('re-throws unexpected errors from repairLinks', async () => {
    const wf = makeWorkflow()
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([])
    repairLinksMock.mockImplementation(() => {
      throw new TypeError('boom')
    })

    const { validateWorkflow } = useWorkflowValidation()
    await expect(validateWorkflow(wf)).rejects.toThrow(TypeError)
  })

  it('keeps the original graphData untouched when repair aborts mid-mutation', async () => {
    const wf = makeWorkflow()
    const before = JSON.stringify(wf)
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([])
    repairLinksMock.mockImplementation((g: ComfyWorkflowJSON) => {
      ;(g.nodes as unknown as Array<{ id: number }>)[0]!.id = 999
      throw new LinkRepairAbortedError({
        kind: 'missing-origin-node',
        link: makeLink(1)
      })
    })

    const { validateWorkflow } = useWorkflowValidation()
    await validateWorkflow(wf)

    expect(JSON.stringify(wf)).toBe(before)
  })

  it('silent option suppresses toasts but still validates', async () => {
    const wf = makeWorkflow()
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([
      { kind: 'missing-origin-node', link: makeLink(1) }
    ])
    repairLinksMock.mockImplementation((g) =>
      repairResult(g, { fixed: true, patched: 1, deleted: 0 })
    )

    const { validateWorkflow } = useWorkflowValidation()
    const out = await validateWorkflow(wf, { silent: true })

    expect(out.graphData).not.toBeNull()
    expect(toastAddMock).not.toHaveBeenCalled()
    expect(toastAddAlertMock).not.toHaveBeenCalled()
  })
})
