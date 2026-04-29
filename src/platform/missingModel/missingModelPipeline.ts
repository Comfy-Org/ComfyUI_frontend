import { st } from '@/i18n'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import {
  enrichWithEmbeddedMetadata,
  scanAllModelCandidates,
  verifyAssetSupportedCandidates
} from '@/platform/missingModel/missingModelScan'
import type { MissingModelWorkflowData } from '@/platform/missingModel/missingModelScan'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { updatePendingWarnings } from '@/platform/workflow/core/utils/pendingWarnings'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import type { ModelFile } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { MissingNodeType } from '@/types/comfy'
import {
  isAncestorPathActive,
  isMissingCandidateActive
} from '@/utils/graphTraversalUtil'

export interface MissingModelPipelineResult {
  missingModels: ModelFile[]
  confirmedCandidates: MissingModelCandidate[]
}

interface MissingModelPipelineStore {
  missingModelCandidates: MissingModelCandidate[] | null
  createVerificationAbortController: () => AbortController
  setFolderPaths: (paths: Record<string, string[]>) => void
  setFileSize: (url: string, size: number) => void
}

interface RunMissingModelPipelineOptions {
  graph: LGraph
  graphData: MissingModelWorkflowData
  missingModelStore: MissingModelPipelineStore
  missingNodeTypes?: MissingNodeType[]
  silent?: boolean
}

interface RefreshMissingModelPipelineOptions {
  graph: LGraph
  reloadNodeDefs: () => Promise<void>
  missingModelStore: MissingModelPipelineStore
  silent?: boolean
}

type MissingModelCandidateWithDownloadMetadata = MissingModelCandidate & {
  url: string
  directory: string
}

function cacheModelCandidates(
  wf: Pick<ComfyWorkflow, 'pendingWarnings'> | null | undefined,
  confirmed: MissingModelCandidate[]
) {
  if (!wf) return
  updatePendingWarnings(wf, {
    missingModelCandidates: confirmed
  })
}

function hasDownloadMetadata(
  candidate: MissingModelCandidate
): candidate is MissingModelCandidateWithDownloadMetadata {
  return !!candidate.url && !!candidate.directory
}

function toModelFile(candidate: MissingModelCandidateWithDownloadMetadata) {
  return {
    name: candidate.name,
    url: candidate.url,
    directory: candidate.directory,
    hash: candidate.hash,
    hash_type: candidate.hashType
  }
}

function getCurrentMissingModelMetadata(
  missingModelStore: MissingModelPipelineStore
): ModelFile[] {
  return (
    missingModelStore.missingModelCandidates
      ?.filter(hasDownloadMetadata)
      .map(toModelFile) ?? []
  )
}

export async function runMissingModelPipeline({
  graph,
  graphData,
  missingModelStore,
  missingNodeTypes,
  silent = false
}: RunMissingModelPipelineOptions): Promise<MissingModelPipelineResult> {
  const controller = missingModelStore.createVerificationAbortController()

  const getDirectory = (nodeType: string) =>
    useModelToNodeStore().getCategoryForNodeType(nodeType)
  const isAssetBrowserWidget = isCloud
    ? (nodeType: string, widgetName: string) =>
        assetService.shouldUseAssetBrowser(nodeType, widgetName)
    : () => false

  const candidates = scanAllModelCandidates(
    graph,
    isAssetBrowserWidget,
    getDirectory
  )

  const modelStore = useModelStore()
  await modelStore.loadModelFolders()
  const enrichedAll = await enrichWithEmbeddedMetadata(
    candidates,
    graphData,
    async (name, directory) => {
      const folder = await modelStore.getLoadedModelFolder(directory)
      const models = folder?.models
      return !!(
        models && Object.values(models).some((m) => m.file_name === name)
      )
    },
    isCloud ? isAssetBrowserWidget : undefined
  )

  // Drop candidates whose enclosing subgraph is muted/bypassed. Per-node
  // scans only checked each node's own mode; the cascade from an
  // inactive container to its interior happens here.
  // Asymmetric on purpose: a candidate dropped here is not resurrected if
  // the user un-bypasses the container mid-verification. The realtime
  // mode-change path (handleNodeModeChange → scanAndAddNodeErrors) is
  // responsible for surfacing errors after an un-bypass.
  const enrichedCandidates = enrichedAll.filter(
    (c) => c.nodeId == null || isAncestorPathActive(graph, String(c.nodeId))
  )

  const confirmedCandidates = enrichedCandidates.filter(
    (c) => c.isMissing === true
  )

  const missingModels: ModelFile[] = confirmedCandidates
    .filter(hasDownloadMetadata)
    .map(toModelFile)

  const activeWf = useWorkspaceStore().workflow.activeWorkflow
  updatePendingWarnings(activeWf, {
    ...(missingNodeTypes ? { missingNodeTypes } : {}),
    missingModelCandidates: confirmedCandidates
  })

  if (enrichedCandidates.length) {
    if (isCloud) {
      void verifyAssetSupportedCandidates(enrichedCandidates, controller.signal)
        .then(() => {
          if (controller.signal.aborted) return
          // Re-check ancestor: user may have bypassed a container
          // while verification was in flight.
          const confirmedAfterReverify = enrichedCandidates.filter((c) =>
            isMissingCandidateActive(graph, c)
          )
          useExecutionErrorStore().surfaceMissingModels(
            confirmedAfterReverify,
            { silent }
          )
          cacheModelCandidates(activeWf, confirmedAfterReverify)
        })
        .catch((err) => {
          console.warn(
            '[Missing Model Pipeline] Asset verification failed:',
            err
          )
          useToastStore().add({
            severity: 'warn',
            summary: st(
              'toastMessages.missingModelVerificationFailed',
              'Failed to verify missing models. Some models may not be shown in the Errors tab.'
            ),
            life: 5000
          })
        })
    } else {
      if (!confirmedCandidates.length) {
        useExecutionErrorStore().surfaceMissingModels([], { silent })
        cacheModelCandidates(activeWf, [])
      } else {
        void api
          .getFolderPaths()
          .then((paths) => {
            if (controller.signal.aborted) return
            missingModelStore.setFolderPaths(paths)
          })
          .catch((err) => {
            console.warn(
              '[Missing Model Pipeline] Failed to fetch folder paths:',
              err
            )
          })
          .finally(() => {
            if (controller.signal.aborted) return
            useExecutionErrorStore().surfaceMissingModels(confirmedCandidates, {
              silent
            })
            cacheModelCandidates(activeWf, confirmedCandidates)
          })

        const missingModelDownload =
          import('@/platform/missingModel/missingModelDownload')
        void Promise.allSettled(
          confirmedCandidates
            .filter(
              (c): c is MissingModelCandidate & { url: string } => !!c.url
            )
            .map(async (c) => {
              const { fetchModelMetadata } = await missingModelDownload
              const metadata = await fetchModelMetadata(c.url)
              if (!controller.signal.aborted && metadata.fileSize !== null) {
                missingModelStore.setFileSize(c.url, metadata.fileSize)
              }
            })
        )
      }
    }
  } else {
    useExecutionErrorStore().surfaceMissingModels([], { silent })
    cacheModelCandidates(activeWf, [])
  }

  return { missingModels, confirmedCandidates }
}

export async function refreshMissingModelPipeline({
  graph,
  reloadNodeDefs,
  missingModelStore,
  silent = true
}: RefreshMissingModelPipelineOptions): Promise<MissingModelPipelineResult> {
  await reloadNodeDefs()
  const graphData: MissingModelWorkflowData = graph.serialize()
  const activeWorkflowState =
    useWorkspaceStore().workflow.activeWorkflow?.activeState
  const currentModelMetadata = getCurrentMissingModelMetadata(missingModelStore)
  const models = activeWorkflowState?.models?.length
    ? activeWorkflowState.models
    : currentModelMetadata

  return runMissingModelPipeline({
    graph,
    graphData: models.length ? { ...graphData, models } : graphData,
    missingModelStore,
    silent
  })
}
