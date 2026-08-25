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
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

const { activeWorkflow } = vi.hoisted(() => {
  const activeWorkflow: Pick<ComfyWorkflow, 'pendingWarnings'> = {
    pendingWarnings: null
  }
  return { activeWorkflow }
})

// The real store reaches authStore -> firebase setPersistence, which has no
// config under vitest. Mirrors missingModelPipeline.test.ts.
vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ workflow: { activeWorkflow } })
}))

beforeEach(() => {
  activeWorkflow.pendingWarnings = null
})

async function startPendingWorkflowLoadMediaVerification(
  rootGraph: LGraph,
  pendingCandidate: MissingMediaCandidate
): Promise<() => void> {
  vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
    pendingCandidate
  ])
  const { verifySpy, resolveVerification } = deferMediaVerification()

  await runMissingMediaPipeline({ rootGraph, silent: true })
  await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

  return resolveVerification
}

describe('runMissingMediaPipeline', () => {
  it('clears a stale missing-media snapshot after a synchronous rescan resolves it', async () => {
    const {
      rootGraph,
      hosts: [host]
    } = createPromotedMediaRuntime()
    const staleCandidate = createPromotedMissingMediaCandidate(host)
    vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
      { ...staleCandidate, isMissing: false }
    ])
    useMissingMediaStore().setMissingMedia([staleCandidate])

    await runMissingMediaPipeline({ rootGraph, silent: true })

    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })

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

  it('neither surfaces nor caches workflow-load media when the promoted host value changed during verification', async () => {
    const {
      rootGraph,
      hosts: [host]
    } = createPromotedMediaRuntime()
    const pendingCandidate = {
      ...createPromotedMissingMediaCandidate(host),
      isMissing: undefined
    }
    const resolveVerification = await startPendingWorkflowLoadMediaVerification(
      rootGraph,
      pendingCandidate
    )

    const hostWidget = host.widgets?.[0]
    if (!hostWidget) throw new Error('Expected promoted image host widget')
    hostWidget.value = 'user-picked-valid.png'
    resolveVerification()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect.soft(useMissingMediaStore().missingMediaCandidates).toBeNull()
    expect(activeWorkflow.pendingWarnings).toBeNull()
  })
})
