import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'
import { createPromotedMediaRuntime } from '@/platform/missingMedia/__fixtures__/promotedMedia'
import { runMissingMediaPipeline } from '@/platform/missingMedia/missingMediaPipeline'
import * as missingMediaScan from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { createNodeExecutionId } from '@/types/nodeIdentification'

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({ workflow: { activeWorkflow: null } })
}))

beforeEach(() => {
  vi.restoreAllMocks()
  setActivePinia(createTestingPinia({ stubActions: false }))
})

function createPromotedMissingMediaCandidate(
  host: LGraphNode
): MissingMediaCandidate {
  return fromAny<MissingMediaCandidate, unknown>({
    nodeId: createNodeExecutionId([host.id]),
    nodeType: 'LoadImage',
    widgetName: 'outer_image',
    mediaType: 'image',
    name: 'missing-host.png',
    isMissing: true
  })
}

async function startPendingWorkflowLoadMediaVerification(
  rootGraph: LGraph,
  pendingCandidate: MissingMediaCandidate
): Promise<() => void> {
  vi.spyOn(missingMediaScan, 'scanAllMediaCandidates').mockReturnValue([
    pendingCandidate
  ])
  let resolveVerification: (() => void) | undefined
  const verification = new Promise<void>((resolve) => {
    resolveVerification = resolve
  })
  const verifySpy = vi
    .spyOn(missingMediaScan, 'verifyMediaCandidates')
    .mockImplementation(async (candidates) => {
      await verification
      for (const candidate of candidates) candidate.isMissing = true
    })

  await runMissingMediaPipeline({ graph: rootGraph, silent: true })
  await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

  if (!resolveVerification) throw new Error('Expected pending verification')
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

    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })
})
