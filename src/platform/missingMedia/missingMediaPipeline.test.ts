import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import {
  createPromotedMediaRuntime,
  createPromotedMissingMediaCandidate,
  deferMediaVerification
} from '@/platform/missingMedia/__fixtures__/promotedMedia'
import { runMissingMediaPipeline } from '@/platform/missingMedia/missingMediaPipeline'
import * as missingMediaScan from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { t } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'

let activeWorkflow: ComfyWorkflow

beforeEach(() => {
  activeWorkflow = new ComfyWorkflow({
    path: 'test.json',
    modified: 0,
    size: 0
  })
  Object.assign(useWorkflowStore(), { activeWorkflow })
})

async function startPendingWorkflowLoadMediaVerification(
  rootGraph: LGraph,
  pendingCandidate: MissingMediaCandidate,
  onVerified?: (candidates: MissingMediaCandidate[]) => void
): Promise<() => void> {
  vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
    pendingCandidate
  ])
  const { verifySpy, resolveVerification } = deferMediaVerification()

  await runMissingMediaPipeline({ rootGraph, silent: true, onVerified })
  await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

  return resolveVerification
}

describe('runMissingMediaPipeline', () => {
  it.for([
    {
      outcome: 'verified missing',
      completed: true,
      failed: false,
      resolvedMissing: true
    },
    {
      outcome: 'verified present',
      completed: true,
      failed: false,
      resolvedMissing: false
    },
    {
      outcome: 'failed',
      completed: false,
      failed: true,
      resolvedMissing: undefined
    },
    {
      outcome: 'aborted',
      completed: false,
      failed: false,
      resolvedMissing: undefined
    }
  ])(
    'reports verification completion only for a successful scan: $outcome',
    async ({ outcome, completed, failed, resolvedMissing }) => {
      const {
        rootGraph,
        hosts: [host]
      } = createPromotedMediaRuntime()
      const candidate: MissingMediaCandidate = {
        ...createPromotedMissingMediaCandidate(host),
        isMissing: undefined
      }
      vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
        candidate
      ])
      let finishVerification = () => {}
      const pending = new Promise<void>((resolve) => {
        finishVerification = resolve
      })
      vi.spyOn(missingMediaScan, 'verifyMediaCandidates').mockImplementation(
        async () => {
          await pending
          if (outcome === 'failed') throw new Error('asset service unavailable')
          candidate.isMissing = resolvedMissing
        }
      )
      const onVerified = vi.fn()

      await runMissingMediaPipeline({ rootGraph, silent: true, onVerified })
      expect(onVerified).not.toHaveBeenCalled()
      if (outcome === 'aborted') useMissingMediaStore().clearMissingMedia()
      finishVerification()
      await vi.runAllTimersAsync()

      expect(onVerified.mock.calls).toEqual(
        completed ? [[[{ ...candidate, isMissing: resolvedMissing }]]] : []
      )
      expect(vi.mocked(useToastStore().add).mock.calls).toEqual(
        failed
          ? [
              [
                expect.objectContaining({
                  severity: 'warn',
                  summary: t('toastMessages.missingMediaVerificationFailed')
                })
              ]
            ]
          : []
      )
    }
  )

  it('surfaces workflow-load media when another fanout consumer stays active during verification', async () => {
    const {
      rootGraph,
      hosts: [host],
      sourceNodes
    } = createPromotedMediaRuntime({ sourceIds: [42, 43, 44] })
    const pendingCandidate = {
      ...createPromotedMissingMediaCandidate(host),
      isMissing: undefined
    }
    const resolveVerification = await startPendingWorkflowLoadMediaVerification(
      rootGraph,
      pendingCandidate
    )

    sourceNodes[0].mode = LGraphEventMode.BYPASS
    resolveVerification()

    await vi.waitFor(() => {
      expect(useMissingMediaStore().missingMediaCandidates).toEqual([
        pendingCandidate
      ])
    })
  })

  it('does not surface workflow-load media when every fanout consumer becomes bypassed during verification', async () => {
    const {
      rootGraph,
      hosts: [host],
      sourceNodes
    } = createPromotedMediaRuntime({ sourceIds: [42, 43, 44] })
    const pendingCandidate = {
      ...createPromotedMissingMediaCandidate(host),
      isMissing: undefined
    }
    const onVerified = vi.fn()
    const resolveVerification = await startPendingWorkflowLoadMediaVerification(
      rootGraph,
      pendingCandidate,
      onVerified
    )

    for (const sourceNode of sourceNodes) {
      sourceNode.mode = LGraphEventMode.BYPASS
    }
    resolveVerification()
    await vi.waitFor(() => expect(onVerified).toHaveBeenCalledWith([]))

    expect.soft(pendingCandidate.isMissing).toBe(true)
    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })

  it('neither surfaces nor caches workflow-load media when the promoted host value changed during verification', async () => {
    const {
      rootGraph,
      hosts: [host]
    } = createPromotedMediaRuntime()
    const pendingCandidate = {
      ...createPromotedMissingMediaCandidate(host),
      isMissing: undefined
    }
    const onVerified = vi.fn()
    const resolveVerification = await startPendingWorkflowLoadMediaVerification(
      rootGraph,
      pendingCandidate,
      onVerified
    )

    const hostWidget = host.widgets.at(0)
    if (!hostWidget) throw new Error('Expected promoted image host widget')
    hostWidget.value = 'user-picked-valid.png'
    resolveVerification()
    await vi.waitFor(() => expect(onVerified).toHaveBeenCalledWith([]))

    expect.soft(useMissingMediaStore().missingMediaCandidates).toBeNull()
    expect(activeWorkflow.pendingWarnings).toBeNull()
  })
})
vi.mock(import('firebase/auth'))
