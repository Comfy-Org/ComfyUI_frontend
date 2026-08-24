import { describe, expect, it, vi } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type * as LinkFixer from '@/utils/linkFixer'
import { fixBadLinks } from '@/utils/linkFixer'

import {
  intactWorkflow,
  unidentifiedCorruptWorkflow,
  uniqueId
} from './__fixtures__/corruptWorkflows'
import {
  MAX_REPORTS_PER_KIND,
  useWorkflowValidation
} from './useWorkflowValidation'

const reportError = vi.fn()

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: (...args: unknown[]) => reportError(...args)
}))

vi.mock('@/utils/linkFixer', async (importOriginal) => {
  const actual = await importOriginal<typeof LinkFixer>()
  return { ...actual, fixBadLinks: vi.fn(actual.fixBadLinks) }
})

const reload = (workflow: ComfyWorkflowJSON) =>
  useWorkflowValidation().validateWorkflow(workflow)

/**
 * The reporters are module state, so spending one of them here would leave the
 * rest of a shared file asserting against an exhausted budget. Vitest gives
 * each file its own module registry; this one is that budget's own file, so no
 * ordering rule or `vi.resetModules()` is needed to keep the two apart.
 *
 * A budget can only be spent once per registry, so `retry` is off: a second
 * attempt would assert against the budget the first attempt spent.
 */
describe('useWorkflowValidation reporting budget', { retry: 0 }, () => {
  it('keeps reporting fixer failures after corruption reports run out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    for (let i = 0; i < MAX_REPORTS_PER_KIND; i++) {
      await reload(unidentifiedCorruptWorkflow())
    }
    expect(reportError).toHaveBeenCalledTimes(MAX_REPORTS_PER_KIND)

    reportError.mockClear()
    await reload(unidentifiedCorruptWorkflow())
    expect(reportError).not.toHaveBeenCalled()

    const cause = 'link fixer exploded'
    vi.mocked(fixBadLinks).mockImplementation(() => {
      throw new Error(cause)
    })
    await reload(intactWorkflow(uniqueId()))

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: cause }),
      expect.objectContaining({ errorType: 'workflow_link_fixer_failure' })
    )
  })
})
