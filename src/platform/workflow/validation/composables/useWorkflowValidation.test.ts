import { describe, expect, it, vi } from 'vitest'

import type { ReportErrorOptions } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type * as LinkFixer from '@/utils/linkFixer'
import { fixBadLinks } from '@/utils/linkFixer'

import {
  corruptWorkflow,
  intactWorkflow,
  unidentifiedCorruptWorkflow,
  uniqueId
} from './__fixtures__/corruptWorkflows'
import { useWorkflowValidation } from './useWorkflowValidation'

const reportError = vi.fn()

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: (...args: unknown[]) => reportError(...args)
}))

vi.mock('@/utils/linkFixer', async (importOriginal) => {
  const actual = await importOriginal<typeof LinkFixer>()
  return { ...actual, fixBadLinks: vi.fn(actual.fixBadLinks) }
})

const actualLinkFixer =
  await vi.importActual<typeof LinkFixer>('@/utils/linkFixer')

/** Tees every line the real fixer emits, without changing what it does. */
function captureFixerLogs(): string[] {
  const lines: string[] = []
  vi.mocked(fixBadLinks).mockImplementation((graph, options = {}) =>
    actualLinkFixer.fixBadLinks(graph, {
      ...options,
      logger: {
        log: (...args: unknown[]) => {
          lines.push(args.join(' '))
          options.logger?.log(...args)
        }
      }
    })
  )
  return lines
}

const reportedOptions = (call = 0) =>
  (reportError.mock.calls[call] as [Error, ReportErrorOptions])[1]

/**
 * `loadGraphData` builds the composable anew for every load, so a test that
 * reuses one instance cannot tell a per-session guard from a per-load one.
 */
const reload = (workflow: ComfyWorkflowJSON) =>
  useWorkflowValidation().validateWorkflow(workflow)

describe('useWorkflowValidation', () => {
  it('reports the corruption the link fixer found while loading a workflow', async () => {
    await useWorkflowValidation().validateWorkflow(corruptWorkflow(uniqueId()))

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Workflow loaded with corrupt links'
      }),
      expect.objectContaining({
        errorType: 'workflow_link_corruption',
        level: 'warning',
        tags: { unrepaired: false },
        context: expect.objectContaining({ patched: 1, deleted: 1 })
      })
    )
  })

  it('attributes the report to the workflow it came from', async () => {
    const workflowId = uniqueId()

    await useWorkflowValidation().validateWorkflow(corruptWorkflow(workflowId))

    expect(reportedOptions().context?.workflowId).toBe(workflowId)
  })

  it('digests the fixer log instead of forwarding it', async () => {
    const fixerLogs = captureFixerLogs()

    await useWorkflowValidation().validateWorkflow(corruptWorkflow(uniqueId()))

    const options = reportedOptions()
    expect(options.context?.corruptionDigest).toMatch(/^[0-9a-f]{8}$/)
    expect(fixerLogs).not.toHaveLength(0)
    const payload = JSON.stringify(options)
    for (const line of fixerLogs) expect(payload).not.toContain(line)
  })

  it('reports, without a toast, when validation is silenced', async () => {
    const { graphData } = await useWorkflowValidation().validateWorkflow(
      corruptWorkflow(uniqueId()),
      { silent: true }
    )

    expect(reportError).toHaveBeenCalledOnce()
    expect(useToastStore().add).not.toHaveBeenCalled()
    expect(graphData?.links).toHaveLength(0)
  })

  it('reports a corrupt workflow once, not once per reload', async () => {
    const workflowId = uniqueId()

    await reload(corruptWorkflow(workflowId))
    await reload(corruptWorkflow(workflowId))

    expect(reportError).toHaveBeenCalledOnce()
  })

  it('does not collapse distinct workflows that carry no id', async () => {
    await reload(unidentifiedCorruptWorkflow())
    await reload(unidentifiedCorruptWorkflow())

    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('counts each identified workflow carrying the same corruption', async () => {
    await reload(corruptWorkflow(uniqueId()))
    await reload(corruptWorkflow(uniqueId()))

    expect(reportError).toHaveBeenCalledTimes(2)
    const [first, second] = [reportedOptions(0), reportedOptions(1)]
    expect(first.context?.corruptionDigest).toBe(
      second.context?.corruptionDigest
    )
    expect(first.context?.workflowId).not.toBe(second.context?.workflowId)
  })

  it('stays quiet for an intact workflow', async () => {
    await useWorkflowValidation().validateWorkflow(intactWorkflow(uniqueId()))

    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports the link fixer throwing rather than only logging it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fixBadLinks).mockImplementation(() => {
      throw new Error('link fixer exploded')
    })

    await useWorkflowValidation().validateWorkflow(intactWorkflow(uniqueId()))

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'link fixer exploded' }),
      expect.objectContaining({ errorType: 'workflow_link_fixer_failure' })
    )
  })

  it('reports a fixer that keeps failing the same way once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fixBadLinks).mockImplementation(() => {
      throw new Error('link fixer exploded')
    })
    const workflowId = uniqueId()

    await reload(intactWorkflow(workflowId))
    await reload(intactWorkflow(workflowId))

    expect(reportError).toHaveBeenCalledOnce()
  })
})
