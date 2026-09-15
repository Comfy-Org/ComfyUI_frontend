import { st } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { isCloud } from '@/platform/distribution/types'
import {
  isMissingMediaCandidateActive,
  isMissingMediaCandidateScopeActive,
  scanAllMediaCandidates,
  verifyMediaCandidates
} from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { updatePendingWarnings } from '@/platform/workflow/core/utils/pendingWarnings'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface RunMissingMediaPipelineOptions {
  rootGraph: LGraph
  silent?: boolean
}

function cacheMediaCandidates(
  wf: Pick<ComfyWorkflow, 'pendingWarnings'> | null | undefined,
  confirmed: MissingMediaCandidate[]
) {
  if (!wf) return
  updatePendingWarnings(wf, {
    missingMediaCandidates: confirmed
  })
}

export async function runMissingMediaPipeline({
  rootGraph,
  silent = false
}: RunMissingMediaPipelineOptions): Promise<void> {
  const missingMediaStore = useMissingMediaStore()
  const activeWf = useWorkspaceStore().workflow.activeWorkflow
  const allCandidates = scanAllMediaCandidates(rootGraph, isCloud)
  // Drop candidates whose enclosing subgraph is muted/bypassed.
  const candidates = allCandidates.filter((candidate) =>
    isMissingMediaCandidateScopeActive(rootGraph, candidate)
  )

  if (!candidates.length) {
    cacheMediaCandidates(activeWf, [])
    return
  }

  const pending = candidates.some((c) => c.isMissing === undefined)
  if (pending) {
    const controller = missingMediaStore.createVerificationAbortController()
    void verifyMediaCandidates(candidates, {
      isCloud,
      signal: controller.signal
    })
      .then(() => {
        if (controller.signal.aborted) return
        // Re-check ancestor after async verification (see model pipeline).
        const confirmed = candidates.filter((candidate) =>
          isMissingMediaCandidateActive(rootGraph, candidate)
        )
        if (confirmed.length) {
          useExecutionErrorStore().surfaceMissingMedia(confirmed, { silent })
        }
        cacheMediaCandidates(activeWf, confirmed)
      })
      .catch((err) => {
        console.warn('[Missing Media Pipeline] Asset verification failed:', err)
        useToastStore().add({
          severity: 'warn',
          summary: st(
            'toastMessages.missingMediaVerificationFailed',
            'Failed to verify missing media. Some inputs may not be shown in the Issues tab.'
          ),
          life: 5000
        })
      })
  } else {
    const confirmed = candidates.filter((c) => c.isMissing === true)
    if (confirmed.length) {
      useExecutionErrorStore().surfaceMissingMedia(confirmed, { silent })
    }
    cacheMediaCandidates(activeWf, confirmed)
  }
}
