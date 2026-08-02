import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
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

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ workflow: { activeWorkflow: null } })
}))

beforeEach(() => {
  vi.restoreAllMocks()
  setActivePinia(createTestingPinia({ stubActions: false }))
})

async function startPendingWorkflowLoadMediaVerification(
  rootGraph: LGraph,
  pendingCandidate: MissingMediaCandidate
): Promise<() => void> {
  vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
    pendingCandidate
  ])
  const { verifySpy, resolveVerification } = deferMediaVerification()

  await runMissingMediaPipeline({ graph: rootGraph, silent: true })
  await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

  return resolveVerification
}

describe('runMissingMediaPipeline', () => {
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
    const resolveVerification = await startPendingWorkflowLoadMediaVerification(
      rootGraph,
      pendingCandidate
    )

    for (const sourceNode of sourceNodes) {
      sourceNode.mode = LGraphEventMode.BYPASS
    }
    resolveVerification()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect.soft(pendingCandidate.isMissing).toBe(true)
    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })
})
