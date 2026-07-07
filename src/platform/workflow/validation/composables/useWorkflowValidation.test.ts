import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowValidation } from '@/platform/workflow/validation/composables/useWorkflowValidation'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

const { toastStore, validateComfyWorkflow, fixBadLinks } = vi.hoisted(() => ({
  toastStore: {
    add: vi.fn(),
    addAlert: vi.fn()
  },
  validateComfyWorkflow: vi.fn(),
  fixBadLinks: vi.fn()
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => toastStore
}))

vi.mock('@/platform/workflow/validation/schemas/workflowSchema', () => ({
  validateComfyWorkflow
}))

vi.mock('@/utils/linkFixer', () => ({
  fixBadLinks
}))

function workflow(): ComfyWorkflowJSON {
  return {
    last_node_id: 0,
    last_link_id: 0,
    nodes: [],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  } as ComfyWorkflowJSON
}

beforeEach(() => {
  toastStore.add.mockReset()
  toastStore.addAlert.mockReset()
  validateComfyWorkflow.mockReset()
  fixBadLinks.mockReset()
})

describe('useWorkflowValidation', () => {
  it('validates workflows, fixes bad links, and reports warnings', async () => {
    const graph = workflow()
    validateComfyWorkflow.mockResolvedValue(graph)
    fixBadLinks.mockImplementation(
      (
        fixedGraph: ComfyWorkflowJSON,
        options: { logger: { log: (...args: unknown[]) => void } }
      ) => {
        options.logger.log('removed', 'stale-link')
        return { fixed: true, patched: 2, deleted: 1, graph: fixedGraph }
      }
    )

    const result = await useWorkflowValidation().validateWorkflow(graph)

    expect(result.graphData).toBe(graph)
    expect(toastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warn',
        detail: 'removed stale-link'
      })
    )
    expect(toastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        detail: 'Fixed 2 node connections and removed 1 invalid links.'
      })
    )
  })

  it('suppresses validation toasts in silent mode', async () => {
    const graph = workflow()
    validateComfyWorkflow.mockResolvedValue(graph)
    fixBadLinks.mockReturnValue({
      fixed: true,
      patched: 1,
      deleted: 0,
      graph
    })

    await useWorkflowValidation().validateWorkflow(graph, { silent: true })

    expect(toastStore.add).not.toHaveBeenCalled()
    expect(toastStore.addAlert).not.toHaveBeenCalled()
    expect(fixBadLinks).toHaveBeenCalledWith(
      graph,
      expect.objectContaining({ silent: true })
    )
  })

  it('reports schema validation failures and returns null graph data', async () => {
    const error = new Error('invalid workflow')
    validateComfyWorkflow.mockImplementation(
      async (_graph: ComfyWorkflowJSON, onError: (err: Error) => void) => {
        onError(error)
        return null
      }
    )

    const result = await useWorkflowValidation().validateWorkflow(workflow())

    expect(result.graphData).toBeNull()
    expect(toastStore.addAlert).toHaveBeenCalledWith(error)
    expect(fixBadLinks).not.toHaveBeenCalled()
  })

  it('keeps validation failure local when link fixing throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('link fix failed')
    const graph = workflow()
    validateComfyWorkflow.mockResolvedValue(graph)
    fixBadLinks.mockImplementation(() => {
      throw error
    })

    const result = await useWorkflowValidation().validateWorkflow(graph)

    expect(result.graphData).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(error)

    consoleSpy.mockRestore()
  })
})
