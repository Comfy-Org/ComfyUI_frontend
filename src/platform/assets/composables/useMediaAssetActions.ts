import { uniqBy } from 'es-toolkit'
import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'
import { useWorkflowActionsService } from '@/platform/workflow/core/services/workflowActionsService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  getAssetDisplayName,
  getAssetStoredFilename
} from '../utils/assetMetadataUtils'
import { getAssetType } from '../utils/assetTypeUtil'
import { getAssetUrl } from '../utils/assetUrlUtil'
import { clearDeletedAssetWidgetValues } from '../utils/clearDeletedAssetWidgetValues'
import { clearNodePreviewCacheForValues } from '../utils/clearNodePreviewCacheForValues'
import { markDeletedAssetsAsMissingMedia } from '../utils/markDeletedAssetsAsMissingMedia'
import { getTotalAssetOutputCount } from '../utils/outputAssetCountUtil'
import { resolveOutputAssetItems } from '../utils/outputAssetUtil'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import { isResultItemType } from '@/utils/typeGuardUtil'

import { useAssetExportStore } from '@/stores/assetExportStore'

import type { AssetId, AssetItem } from '../schemas/assetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'

const EXCLUDED_TAGS = new Set(['models', 'input', 'output'])

function createAssetWidgetPath(asset: AssetItem): string {
  const metadata = getOutputAssetMetadata(asset.user_metadata)
  const assetType = getAssetType(asset, 'input')

  return createAnnotatedPath({
    filename: getAssetStoredFilename(asset),
    subfolder: metadata?.subfolder ?? '',
    type: isResultItemType(assetType) ? assetType : undefined
  })
}

/**
 * Canonical widget-value strings that may reference this asset, scoped by the
 * asset's source type so basenames cannot cross-match across input/output.
 *
 * Output assets emit `<name> [output]` (and the subfolder-prefixed form when
 * present in metadata). Input/temp assets emit the bare name plus the explicit
 * annotation. The content `hash` is included whenever present, since
 * cloud-stored assets can be referenced by hash.
 */
function widgetValueVariants(
  name: string | undefined,
  type: string,
  subfolder?: string,
  hash?: string
): string[] {
  const variants: string[] = []
  if (name) {
    if (type === 'output') {
      const path = subfolder ? `${subfolder}/${name}` : name
      variants.push(`${path} [output]`)
    } else if (type === 'temp') {
      variants.push(`${name} [temp]`)
    } else {
      variants.push(name)
      variants.push(`${name} [input]`)
    }
  }
  if (hash) variants.push(hash)
  return variants
}

export function useMediaAssetActions() {
  const { t } = useI18n()
  const toast = useToast()
  const assetsStore = useAssetsStore()
  const dialogService = useDialogService()
  const mediaContext = inject(MediaAssetKey, null)
  const { copyToClipboard } = useCopyToClipboard()
  const { flags } = useFeatureFlags()
  const workflowActions = useWorkflowActionsService()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()

  /**
   * Download one or more assets.
   * In cloud mode, creates a ZIP export via the backend when called with
   * 2+ assets or with any asset whose job has `outputCount > 1`.
   * In OSS mode, downloads each file directly, expanding grouped assets
   * (`outputCount > 1`) into their individual outputs.
   * With no argument, uses the asset from `MediaAssetKey` context.
   */
  const downloadAssets = (assets?: AssetItem[]) => {
    const targetAssets =
      assets ?? (mediaContext?.asset.value ? [mediaContext.asset.value] : [])
    if (targetAssets.length === 0) return

    const hasMultiOutputJobs = targetAssets.some((a) => {
      const count = getOutputAssetMetadata(a.user_metadata)?.outputCount
      return typeof count === 'number' && count > 1
    })

    if (isCloud && (targetAssets.length > 1 || hasMultiOutputJobs)) {
      void downloadAssetsAsZip(targetAssets)
      return
    }

    if (hasMultiOutputJobs) {
      void downloadAssetsIndividually(targetAssets)
      return
    }

    try {
      targetAssets.forEach((asset) => downloadSingleAsset(asset))
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.downloadsStarted', targetAssets.length),
        life: 2000
      })
    } catch (error) {
      console.error('Failed to download assets:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.failedToDownloadImage')
      })
    }
  }

  function downloadSingleAsset(asset: AssetItem) {
    const filename = getAssetDisplayName(asset)
    const downloadUrl = asset.preview_url || getAssetUrl(asset)
    downloadFile(downloadUrl, filename)
  }

  async function expandAssetForDownload(
    asset: AssetItem
  ): Promise<AssetItem[]> {
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    if (
      !metadata ||
      typeof metadata.outputCount !== 'number' ||
      metadata.outputCount <= 1
    ) {
      return [asset]
    }

    try {
      const resolved = await resolveOutputAssetItems(metadata, {
        createdAt: asset.created_at
      })
      return resolved.length > 0 ? resolved : [asset]
    } catch (error) {
      console.error('Failed to expand grouped asset for download:', error)
      return [asset]
    }
  }

  async function downloadAssetsIndividually(assets: AssetItem[]) {
    try {
      const expanded = await Promise.all(assets.map(expandAssetForDownload))
      const seenAssetIds = new Set<string>()
      const filesToDownload = expanded.flat().filter((asset) => {
        if (seenAssetIds.has(asset.id)) return false
        seenAssetIds.add(asset.id)
        return true
      })

      filesToDownload.forEach((asset) => downloadSingleAsset(asset))

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t(
          'mediaAsset.selection.downloadsStarted',
          filesToDownload.length
        ),
        life: 2000
      })
    } catch (error) {
      console.error('Failed to download assets:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.failedToDownloadImage')
      })
    }
  }

  async function downloadAssetsAsZip(assets: AssetItem[]) {
    const assetExportStore = useAssetExportStore()

    try {
      const jobIds: string[] = []
      const assetIds: string[] = []
      const namesByJobId = new Map<string, Set<string>>()
      const wholeJobIds = new Set<string>()
      const fileCount = getTotalAssetOutputCount(assets)

      for (const asset of assets) {
        const assetType = getAssetType(asset)
        const metadata = getOutputAssetMetadata(asset.user_metadata)
        if (assetType === 'output' || (assetType === 'temp' && metadata)) {
          const jobId = metadata?.jobId || asset.id
          if (!jobIds.includes(jobId)) {
            jobIds.push(jobId)
          }
          // When outputCount is set, the asset is a job-level selection
          // from the gallery and the user wants all outputs for that job.
          if (metadata?.outputCount != null) {
            wholeJobIds.add(jobId)
          } else if (metadata?.jobId && asset.name) {
            const names = namesByJobId.get(metadata.jobId) ?? new Set<string>()
            names.add(asset.name)
            namesByJobId.set(metadata.jobId, names)
          }
        } else {
          assetIds.push(asset.id)
        }
      }

      // A job-level selection outranks any name filter a sibling child of the
      // same job contributed, whichever order they were selected in.
      const jobAssetNameFilters = Object.fromEntries(
        [...namesByJobId]
          .filter(([jobId]) => !wholeJobIds.has(jobId))
          .map(([jobId, names]): [string, string[]] => [jobId, [...names]])
      )

      const spansMultipleJobs = jobIds.length > 1
      const namingStrategy = spansMultipleJobs
        ? 'group_by_job_time'
        : 'preserve'

      const result = await assetService.createAssetExport({
        ...(jobIds.length > 0 ? { job_ids: jobIds } : {}),
        ...(assetIds.length > 0 ? { asset_ids: assetIds } : {}),
        ...(Object.keys(jobAssetNameFilters).length > 0
          ? { job_asset_name_filters: jobAssetNameFilters }
          : {}),
        naming_strategy: namingStrategy,
        include_previews: true
      })

      assetExportStore.trackExport(result.task_id)

      toast.add({
        severity: 'info',
        summary: t('exportToast.exportStarted'),
        detail: t(
          'mediaAsset.selection.exportStarted',
          { count: fileCount },
          fileCount
        ),
        life: 3000
      })
    } catch (error) {
      console.error('Failed to create asset export:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('exportToast.exportFailedSingle')
      })
    }
  }

  const copyJobId = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    const metadata = getOutputAssetMetadata(targetAsset.user_metadata)
    const jobId =
      metadata?.jobId ||
      (getAssetType(targetAsset) === 'output' ? targetAsset.id : undefined)

    if (!jobId) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.noJobIdFound'),
        life: 2000
      })
      return
    }

    await copyToClipboard(jobId)
  }

  /**
   * Add a loader node to the current workflow for this asset
   * Uses shared utility to detect appropriate node type based on file extension
   */
  const addWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Detect node type using shared utility
    const { nodeType, widgetName } = detectNodeTypeFromFilename(
      targetAsset.name
    )

    if (!nodeType || !widgetName) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.unsupportedFileType'),
        life: 2000
      })
      return
    }

    const nodeDef = nodeDefStore.nodeDefsByName[nodeType]

    const node = withNodeAddSource('programmatic', () =>
      litegraphService.addNodeOnGraph(nodeDef, {
        pos: litegraphService.getCanvasCenter()
      })
    )

    if (!node) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.failedToCreateNode')
      })
      return
    }

    const annotated = createAssetWidgetPath(targetAsset)

    const widget = node.widgets?.find((w) => w.name === widgetName)
    if (widget) {
      widget.value = annotated
      widget.callback?.(annotated)
    }
    node.graph?.setDirtyCanvas(true, true)

    toast.add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('mediaAsset.nodeAddedToWorkflow', { nodeType }),
      life: 2000
    })
  }

  /**
   * Open the workflow from this asset in a new tab
   * Uses shared workflow extraction and action service
   */
  const openWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Extract workflow using shared utility
    const { workflow, filename } = await extractWorkflowFromAsset(targetAsset)

    // Use shared action service
    const result = await workflowActions.openWorkflowAction(workflow, filename)

    if (!result.success) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: result.error || t('mediaAsset.noWorkflowDataFound'),
        life: 2000
      })
    } else {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.workflowOpenedInNewTab'),
        life: 2000
      })
    }
  }

  /**
   * Export the workflow from this asset as a JSON file
   * Uses shared workflow extraction and action service
   */
  const exportWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Extract workflow using shared utility
    const { workflow, filename } = await extractWorkflowFromAsset(targetAsset)

    // Use shared action service
    const result = await workflowActions.exportWorkflowAction(
      workflow,
      filename
    )

    if (result.cancelled) return

    if (!result.success) {
      const isNoWorkflow = result.error?.includes('No workflow')
      toast.add({
        severity: isNoWorkflow ? 'warn' : 'error',
        summary: isNoWorkflow ? t('g.warning') : t('g.error'),
        detail: result.error || t('mediaAsset.failedToExportWorkflow'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.workflowExportedSuccessfully'),
        life: 2000
      })
    }
  }

  /**
   * Add multiple assets to the current workflow
   * Creates loader nodes for each asset
   */
  const addMultipleToWorkflow = async (assets: AssetItem[]) => {
    const NODE_OFFSET = 50
    let nodeIndex = 0
    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      const { nodeType, widgetName } = detectNodeTypeFromFilename(asset.name)

      if (!nodeType || !widgetName) {
        failed++
        continue
      }

      const nodeDef = nodeDefStore.nodeDefsByName[nodeType]

      const center = litegraphService.getCanvasCenter()
      const node = withNodeAddSource('programmatic', () =>
        litegraphService.addNodeOnGraph(nodeDef, {
          pos: [
            center[0] + nodeIndex * NODE_OFFSET,
            center[1] + nodeIndex * NODE_OFFSET
          ]
        })
      )

      if (!node) {
        failed++
        continue
      }

      const annotated = createAssetWidgetPath(asset)

      const widget = node.widgets?.find((w) => w.name === widgetName)
      if (widget) {
        widget.value = annotated
        widget.callback?.(annotated)
      }
      node.graph?.setDirtyCanvas(true, true)
      succeeded++
      nodeIndex++
    }

    if (failed === 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.nodesAddedToWorkflow', {
          count: succeeded
        }),
        life: 2000
      })
    } else if (succeeded === 0) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.selection.failedToAddNodes')
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.partialAddNodesSuccess', {
          succeeded,
          failed
        }),
        life: 3000
      })
    }
  }

  /**
   * Open workflows from multiple assets in new tabs
   */
  const openMultipleWorkflows = async (assets: AssetItem[]) => {
    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      try {
        const { workflow, filename } = await extractWorkflowFromAsset(asset)
        const result = await workflowActions.openWorkflowAction(
          workflow,
          filename
        )

        if (result.success) {
          succeeded++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    if (failed === 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.workflowsOpened', { count: succeeded }),
        life: 2000
      })
    } else if (succeeded === 0) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.noWorkflowsFound'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.partialWorkflowsOpened', {
          succeeded,
          failed
        }),
        life: 3000
      })
    }
  }

  /**
   * Export workflows from multiple assets as JSON files
   */
  const exportMultipleWorkflows = async (assets: AssetItem[]) => {
    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      try {
        const { workflow, filename } = await extractWorkflowFromAsset(asset)
        const result = await workflowActions.exportWorkflowAction(
          workflow,
          filename
        )

        if (result.success) {
          succeeded++
        } else if (!result.cancelled) {
          failed++
        }
      } catch {
        failed++
      }
    }

    // All cancelled
    if (succeeded === 0 && failed === 0) return

    if (failed === 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.workflowsExported', {
          count: succeeded
        }),
        life: 2000
      })
    } else if (succeeded === 0) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.noWorkflowsToExport'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.partialWorkflowsExported', {
          succeeded,
          failed
        }),
        life: 3000
      })
    }
  }

  /**
   * Show confirmation dialog and delete asset(s) if confirmed
   * @param assets Single asset or array of assets to delete
   * @returns true if user confirmed and deletion was attempted, false if cancelled
   */
  async function deleteAssets(input: AssetItem[] | AssetItem) {
    const assets = Array.isArray(input) ? input : [input]
    interface BaseDeleteOperation {
      kind: string
      dependents?: DeleteOperation[]
      markDeletionId?: AssetId
      name?: string
    }
    interface AssetDeletion extends BaseDeleteOperation {
      kind: 'asset'
      variants: string[]
      id: AssetId
      tags?: string[]
    }
    interface JobDeletion extends BaseDeleteOperation {
      kind: 'job'
      id: string
    }
    type DeleteOperation = AssetDeletion | JobDeletion

    function getDeletionPlan(): DeleteOperation[] {
      if (!flags.assetsEnabled) {
        const operations: JobDeletion[] = assets.flatMap((asset) => {
          const markDeletionId = asset.id
          const { jobId } = getOutputAssetMetadata(asset.user_metadata) ?? {}
          if (!jobId) return []

          const name = getAssetDisplayName(asset)
          return [{ kind: 'job', id: jobId, name, markDeletionId }]
        })
        return uniqBy(operations, (op) => op.id)
      }
      if (!flags.assetDeletionEnabled) {
        toast.add({
          detail: t('mediaAsset.deletionUnsupported'),
          life: 5000,
          severity: 'error',
          summary: t('g.error')
        })
        return []
      }
      return assets.flatMap((asset) => {
        const markDeletionId = asset.id
        const metadata = getOutputAssetMetadata(asset.user_metadata)
        const childAssets: AssetDeletion[] = (
          metadata?.allOutputs ?? []
        ).flatMap((output) => {
          if (!output.assetId) return []

          const variants = widgetValueVariants(
            output.filename,
            output.type,
            output.subfolder
          )
          return {
            kind: 'asset',
            markDeletionId,
            name: output.display_name || output.filename,
            id: output.assetId,
            tags: asset.tags,
            variants
          }
        })
        if (childAssets.length > 0) return childAssets

        const variants = widgetValueVariants(
          asset.name,
          getAssetType(asset, 'input'),
          metadata?.subfolder,
          asset.hash
        )
        return [
          {
            kind: 'asset',
            id: asset.id,
            markDeletionId,
            name: getAssetDisplayName(asset),
            tags: asset.tags,
            variants
          }
        ]
      })
    }

    function getNames(operation: DeleteOperation): string[] {
      return [
        ...(operation.name ? [operation.name] : []),
        ...(operation.dependents ? operation.dependents.flatMap(getNames) : [])
      ]
    }
    function getOperationCount(
      kind: string,
      operation: DeleteOperation[]
    ): number {
      return operation.reduce((tally, op) => {
        const selfCount = op.kind === kind ? 1 : 0
        const dependents = getOperationCount(kind, op.dependents ?? [])
        return tally + selfCount + dependents
      }, 0)
    }

    const deletedVariants = new Set<string>()
    const invalidatedModelTags = new Set<string>()

    let deletedAssetCount = 0
    async function deleteAsset(operation: AssetDeletion) {
      await assetService.deleteAsset(operation.id)
      deletedAssetCount++
      for (const variant of operation.variants) deletedVariants.add(variant)
      for (const tag of operation.tags ?? []) {
        if (!EXCLUDED_TAGS.has(tag) && assetsStore.hasCategory(tag))
          invalidatedModelTags.add(tag)
      }
      void assetsStore.inputAssets.invalidate([operation.id])
    }
    let deletedJobCount = 0
    async function deleteJob(operation: JobDeletion) {
      await api.deleteItem('history', operation.id)
      deletedJobCount++
    }
    async function performDelete(
      operation: DeleteOperation
    ): Promise<unknown[]> {
      if (operation.markDeletionId)
        assetsStore.setAssetDeleting(operation.markDeletionId, true)
      try {
        if (operation.dependents) {
          const failedDependents = (
            await Promise.all(operation.dependents.map(performDelete))
          ).flat()
          if (failedDependents.length) return failedDependents
        }

        try {
          if (operation.kind === 'asset') await deleteAsset(operation)
          else await deleteJob(operation)
        } catch (err) {
          return [err]
        }
      } finally {
        if (operation.markDeletionId)
          assetsStore.setAssetDeleting(operation.markDeletionId, false)
      }

      return []
    }

    const deletionPlan = getDeletionPlan()
    if (!deletionPlan.length) return false

    const plannedAssetCount = getOperationCount('asset', deletionPlan)
    const plannedJobCount = getOperationCount('job', deletionPlan)
    const deleteConfirmed = await dialogService.confirm({
      title: t('mediaAsset.deleteItems'),
      type: 'delete',
      message: plannedAssetCount
        ? t('mediaAsset.deletePermanent')
        : t('mediaAsset.deleteHistoryOnly'),
      itemList: deletionPlan.flatMap(getNames)
    })
    if (!deleteConfirmed) return false

    const failedDeletions = (
      await Promise.all(deletionPlan.map(performDelete))
    ).flat()

    const rootGraph = app.rootGraph
    if (deletedVariants.size) {
      const nodeOutputStore = useNodeOutputStore()
      // Order matters: mark + cache-clear both look up nodes by
      // current widget.value, so they must run before
      // clearDeletedAssetWidgetValues blanks those values.
      markDeletedAssetsAsMissingMedia(rootGraph, deletedVariants)
      clearNodePreviewCacheForValues(rootGraph, deletedVariants, (node) =>
        nodeOutputStore.removeNodeOutputsForNode(node)
      )
      clearDeletedAssetWidgetValues(rootGraph, deletedVariants)
      useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
    }

    for (const category of invalidatedModelTags)
      assetsStore.invalidateModelsForCategory(category)

    if (!flags.assetsEnabled) {
      const hasOutputAssets = assets.some((a) => {
        const type = getAssetType(a)
        return type === 'output' || type === 'temp'
      })
      const hasInputAssets = assets.some((a) => getAssetType(a) === 'input')

      if (hasOutputAssets) {
        await assetsStore.outputAssets.invalidate()
      }
      if (hasInputAssets) {
        await assetsStore.inputAssets.invalidate()
      }
    }

    const severity =
      failedDeletions.length === 0
        ? 'success'
        : deletedJobCount || deletedAssetCount
          ? 'warn'
          : 'error'

    const resultMessages: string[] = []
    if (plannedAssetCount) {
      resultMessages.push(
        t(
          'mediaAsset.assetsDeleted',
          { total: plannedAssetCount },
          deletedAssetCount
        )
      )
    }
    if (plannedJobCount) {
      resultMessages.push(
        t('mediaAsset.jobsDeleted', { total: plannedJobCount }, deletedJobCount)
      )
    }

    toast.add({
      detail: resultMessages.join('\n'),
      life: severity === 'success' ? 2000 : 5000,
      severity,
      summary: t(`mediaAsset.assetDelete.${severity}`)
    })
    return true
  }

  return {
    downloadAssets,
    deleteAssets,
    copyJobId,
    addWorkflow,
    addMultipleToWorkflow,
    openWorkflow,
    openMultipleWorkflows,
    exportWorkflow,
    exportMultipleWorkflows
  }
}
