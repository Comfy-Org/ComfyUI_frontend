import { LinkRepairAbortedError } from '@comfyorg/workflow-validation'
import type {
  ComfyWorkflowJSON,
  RepairResult,
  TopologyError
} from '@comfyorg/workflow-validation'
import type * as WorkflowValidationModule from '@comfyorg/workflow-validation'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowValidation } from './useWorkflowValidation'

const toastAddMock = vi.hoisted(() => vi.fn())
const toastAddAlertMock = vi.hoisted(() => vi.fn())

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: toastAddMock,
    addAlert: toastAddAlertMock
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, ...rest: unknown[]) => {
      const last = rest[rest.length - 1]
      const params =
        last && typeof last === 'object' && 'named' in (last as object)
          ? (last as { named: Record<string, unknown> }).named
          : (last as Record<string, unknown> | undefined)
      if (!params) return key
      return `${key}|${JSON.stringify(params)}`
    }
  })
}))

const validateLinkTopologyMock = vi.hoisted(() => vi.fn())
const repairLinksMock = vi.hoisted(() => vi.fn())
const describeTopologyErrorMock = vi.hoisted(() =>
  vi.fn((e: TopologyError) => `desc:${e.kind}:${e.link.linkId}`)
)

vi.mock('@comfyorg/workflow-validation', async () => {
  const actual = await vi.importActual<typeof WorkflowValidationModule>(
    '@comfyorg/workflow-validation'
  )
  return {
    ...actual,
    validateLinkTopology: validateLinkTopologyMock,
    repairLinks: repairLinksMock,
    describeTopologyError: describeTopologyErrorMock
  }
})

const validateComfyWorkflowMock = vi.hoisted(() => vi.fn())
vi.mock('@/platform/workflow/validation/schemas/workflowSchema', () => ({
  validateComfyWorkflow: validateComfyWorkflowMock
}))

vi.mock('@/scripts/utils', () => ({
  clone: <T>(v: T): T => structuredClone(v)
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
    setActivePinia(createPinia())
    toastAddMock.mockClear()
    toastAddAlertMock.mockClear()
    validateLinkTopologyMock.mockReset()
    repairLinksMock.mockReset()
    describeTopologyErrorMock.mockClear()
    validateComfyWorkflowMock.mockReset()
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

    const warns = toastAddMock.mock.calls.filter(([arg]) =>
      (arg as { summary: string }).summary.startsWith(
        'validation.topology.invalidLinks'
      )
    )
    expect(warns).toHaveLength(1)
    const detail = (warns[0]![0] as { detail: string }).detail
    expect(detail).toContain('validation.topology.overflow')
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
      expect.objectContaining({
        severity: 'success',
        summary: expect.stringContaining(
          'validation.topology.linksFixedSummary'
        )
      })
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
    const errorToast = toastAddMock.mock.calls.find(
      ([arg]) => (arg as { severity: string }).severity === 'error'
    )
    expect(errorToast).toBeDefined()
    expect((errorToast![0] as { summary: string }).summary).toContain(
      'validation.topology.abortedSummary'
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

  it('clones graphData before passing to repairLinks so the abort fallback is untouched', async () => {
    const wf = makeWorkflow()
    validateComfyWorkflowMock.mockResolvedValue(wf)
    validateLinkTopologyMock.mockReturnValue([])
    let received: ComfyWorkflowJSON | undefined
    repairLinksMock.mockImplementation((g: ComfyWorkflowJSON) => {
      received = g
      return repairResult(g)
    })

    const { validateWorkflow } = useWorkflowValidation()
    await validateWorkflow(wf)

    expect(received).not.toBe(wf)
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
