import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
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
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import { getOutputGroupAssets } from './media/assetMappers'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'
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
import {
  getAssetOutputCount,
  resolveOutputAssetItems
} from '../utils/outputAssetUtil'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import { isResultItemType } from '@/utils/typeGuardUtil'

import { useAssetExportStore } from '@/stores/assetExportStore'

import type { AssetId, AssetItem } from '../schemas/assetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'

const EXCLUDED_TAGS = new Set(['models', 'input', 'output'])

type DeletionItem = {
  name: string
  id: AssetId
  variants: string[]
}

type ResolvedDeletionAsset = {
  asset: AssetItem
  items: DeletionItem[]
  jobId?: string
  type: string
}

type DeletionRequest =
  | { kind: 'asset'; item: DeletionItem }
  | { kind: 'history'; items: DeletionItem[]; jobId: string }

type DeletionOutcome =
  | { kind: 'succeeded'; items: DeletionItem[] }
  | { kind: 'failed'; items: DeletionItem[]; reason: unknown }

type ExtractedWorkflow = Awaited<ReturnType<typeof extractWorkflowFromAsset>>

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

function createAssetExportPlan(assets: AssetItem[]): {
  request: Parameters<typeof assetService.createAssetExport>[0]
  fileCount: number
} {
  const jobIds = new Set<string>()
  const assetIds: AssetId[] = []
  const jobAssetNameFilters: Record<string, string[]> = {}
  const countedOutputJobIds = new Set<string>()
  let fileCount = 0

  for (const asset of assets) {
    const assetType = getAssetType(asset)
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    if (assetType !== 'output' && (assetType !== 'temp' || !metadata)) {
      assetIds.push(asset.id)
      fileCount++
      continue
    }

    const jobId = asset.job_id || metadata?.jobId || asset.id
    jobIds.add(jobId)
    if (metadata?.outputCount != null) {
      if (!countedOutputJobIds.has(jobId)) {
        countedOutputJobIds.add(jobId)
        fileCount += getAssetOutputCount(asset)
      }
      continue
    }

    fileCount++
    const filterJobId = asset.job_id || metadata?.jobId
    if (filterJobId && asset.name) {
      const names = (jobAssetNameFilters[filterJobId] ??= [])
      if (!names.includes(asset.name)) names.push(asset.name)
    }
  }

  return {
    request: {
      ...(jobIds.size ? { job_ids: [...jobIds] } : {}),
      ...(assetIds.length ? { asset_ids: assetIds } : {}),
      ...(Object.keys(jobAssetNameFilters).length
        ? { job_asset_name_filters: jobAssetNameFilters }
        : {}),
      naming_strategy: jobIds.size > 1 ? 'group_by_job_time' : 'preserve',
      include_previews: true
    },
    fileCount
  }
}

export function useMediaAssetActions() {
  const { t } = useI18n()
  const toast = useToast()
  const dialogStore = useDialogStore()
  const mediaContext = inject(MediaAssetKey, null)
  const { copyToClipboard } = useCopyToClipboard()
  const { flags } = useFeatureFlags()
  const workflowActions = useWorkflowActionsService()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()

  function configureAssetNode(
    node: NonNullable<ReturnType<typeof litegraphService.addNodeOnGraph>>,
    widgetName: string,
    asset: AssetItem
  ) {
    const value = createAssetWidgetPath(asset)
    const widget = node.widgets?.find((widget) => widget.name === widgetName)
    if (widget) {
      widget.value = value
      widget.callback?.(value)
    }
    node.graph?.setDirtyCanvas(true, true)
  }

  async function runWorkflowBatch(
    assets: AssetItem[],
    action: (
      workflow: ExtractedWorkflow['workflow'],
      filename: string
    ) => Promise<{ success: boolean; cancelled?: boolean }>
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      try {
        const { workflow, filename } = await extractWorkflowFromAsset(asset)
        const result = await action(workflow, filename)
        if (result.success) succeeded++
        else if (!result.cancelled) failed++
      } catch {
        failed++
      }
    }

    return { succeeded, failed }
  }

  function resolveDeletionAsset(asset: AssetItem): ResolvedDeletionAsset {
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    const groupedAssets = getOutputGroupAssets(asset)
    const allItems = groupedAssets
      ? groupedAssets.map((child) => ({
          name: getAssetDisplayName(child),
          id: child.id,
          variants: widgetValueVariants(
            child.name,
            getAssetType(child, 'output'),
            getOutputAssetMetadata(child.user_metadata)?.subfolder,
            child.hash
          )
        }))
      : (metadata?.allOutputs ?? []).flatMap((output) => {
          if (!output.assetId) return []
          const name = output.display_name || output.filename
          const variants = widgetValueVariants(
            output.filename,
            output.type,
            output.subfolder
          )
          return { name, id: output.assetId, variants }
        })
    const type = getAssetType(asset, 'input')
    const items =
      allItems.length > 0
        ? allItems
        : [
            {
              name: getAssetDisplayName(asset),
              id: asset.id,
              variants: widgetValueVariants(
                asset.name,
                type,
                metadata?.subfolder,
                asset.hash
              )
            }
          ]

    return { asset, items, jobId: metadata?.jobId, type }
  }

  function planDeletion(
    assets: ResolvedDeletionAsset[],
    assetsEnabled: boolean
  ): DeletionRequest[] {
    return assets.flatMap<DeletionRequest>((asset) => {
      if (
        !assetsEnabled &&
        (asset.type === 'output' || asset.type === 'temp')
      ) {
        return [
          {
            kind: 'history',
            items: asset.items,
            jobId: asset.jobId || asset.asset.id
          }
        ]
      }
      return asset.items.map((item) => ({ kind: 'asset', item }))
    })
  }

  async function executeDeletion(
    request: DeletionRequest
  ): Promise<DeletionOutcome> {
    const items = request.kind === 'asset' ? [request.item] : request.items
    try {
      if (request.kind === 'asset') {
        await assetService.deleteAsset(request.item.id)
      } else {
        await api.deleteItem('history', request.jobId)
      }
      return { kind: 'succeeded', items }
    } catch (reason) {
      return { kind: 'failed', items, reason }
    }
  }

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
    const groupedAssets = getOutputGroupAssets(asset)
    if (groupedAssets) return [...groupedAssets]

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
      const { request, fileCount } = createAssetExportPlan(assets)
      const result = await assetService.createAssetExport(request)

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
    if (!nodeDef) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.nodeTypeNotFound', { nodeType })
      })
      return
    }

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

    configureAssetNode(node, widgetName, targetAsset)

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
    if (!assets || assets.length === 0) return

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
      if (!nodeDef) {
        failed++
        continue
      }

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

      configureAssetNode(node, widgetName, asset)
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
    if (!assets || assets.length === 0) return

    const { succeeded, failed } = await runWorkflowBatch(
      assets,
      workflowActions.openWorkflowAction
    )

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
    if (!assets || assets.length === 0) return

    const { succeeded, failed } = await runWorkflowBatch(
      assets,
      workflowActions.exportWorkflowAction
    )

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
  const deleteAssets = async (
    assets: AssetItem | AssetItem[]
  ): Promise<boolean> => {
    const assetArray = Array.isArray(assets) ? assets : [assets]
    if (assetArray.length === 0) return false

    if (flags.assetsEnabled && !flags.assetDeletionEnabled) {
      toast.add({
        severity: 'warn',
        summary: t('g.error'),
        detail: t('mediaAsset.deletionUnsupported')
      })
      return false
    }

    const resolvedAssets = assetArray.map(resolveDeletionAsset)
    const flatAssets = resolvedAssets.flatMap(({ items }) => items)
    const deletionPlan = planDeletion(resolvedAssets, flags.assetsEnabled)
    const assetsStore = useAssetsStore()
    const isSingle = flatAssets.length === 1

    return new Promise((resolve) => {
      dialogStore.showDialog({
        key: 'delete-assets-confirmation',
        title: isSingle
          ? t('mediaAsset.deleteAssetTitle')
          : t('mediaAsset.deleteSelectedTitle'),
        component: ConfirmationDialogContent,
        props: {
          message: isSingle
            ? t('mediaAsset.deleteAssetDescription')
            : t('mediaAsset.deleteSelectedDescription', {
                count: flatAssets.length
              }),
          type: 'delete',
          itemList: flatAssets.map((r) => r.name),
          onConfirm: async () => {
            assetArray.forEach((asset) =>
              assetsStore.setAssetDeleting(asset.id, true)
            )

            try {
              const outcomes = await Promise.all(
                deletionPlan.map(executeDeletion)
              )
              const succeededIds = new Set(
                outcomes.flatMap((outcome) =>
                  outcome.kind === 'succeeded'
                    ? outcome.items.map(({ id }) => id)
                    : []
                )
              )

              if (flags.assetsEnabled) {
                await Promise.allSettled(
                  resolvedAssets.flatMap(({ items, jobId }) =>
                    jobId && items.every(({ id }) => succeededIds.has(id))
                      ? [api.deleteItem('history', jobId)]
                      : []
                  )
                )
              }

              const succeeded = outcomes.reduce(
                (count, outcome) =>
                  outcome.kind === 'succeeded'
                    ? count + outcome.items.length
                    : count,
                0
              )
              const failed = outcomes.filter(
                (
                  outcome
                ): outcome is Extract<DeletionOutcome, { kind: 'failed' }> =>
                  outcome.kind === 'failed'
              )
              const failedCount = failed.reduce(
                (count, outcome) => count + outcome.items.length,
                0
              )

              failed.forEach((outcome) => {
                console.warn(
                  `Failed to delete assets ${outcome.items
                    .map(({ name }) => name)
                    .join(', ')}:`,
                  outcome.reason
                )
              })

              const rootGraph = app.rootGraph
              if (rootGraph) {
                const deletedValues = new Set<string>()
                outcomes.forEach((outcome) => {
                  if (outcome.kind !== 'succeeded') return
                  for (const item of outcome.items) {
                    for (const value of item.variants) {
                      deletedValues.add(value)
                    }
                  }
                })
                if (deletedValues.size > 0) {
                  const nodeOutputStore = useNodeOutputStore()
                  // Order matters: mark + cache-clear both look up nodes by
                  // current widget.value, so they must run before
                  // clearDeletedAssetWidgetValues blanks those values.
                  markDeletedAssetsAsMissingMedia(rootGraph, deletedValues)
                  clearNodePreviewCacheForValues(
                    rootGraph,
                    deletedValues,
                    (node) => nodeOutputStore.removeNodeOutputsForNode(node)
                  )
                  clearDeletedAssetWidgetValues(rootGraph, deletedValues)
                  useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState()
                }
              }

              // Invalidate model caches for affected categories
              const modelCategories = new Set<string>()

              for (const asset of assetArray) {
                for (const tag of asset.tags ?? []) {
                  if (EXCLUDED_TAGS.has(tag)) continue
                  if (assetsStore.hasCategory(tag)) {
                    modelCategories.add(tag)
                  }
                }
              }

              for (const category of modelCategories) {
                assetsStore.invalidateModelsForCategory(category)
              }

              if (flags.assetsEnabled && succeededIds.size > 0) {
                const ids = [...succeededIds]
                void Promise.all([
                  assetsStore.inputAssets.invalidate(ids),
                  assetsStore.outputAssets.invalidate(ids)
                ])
              } else if (!flags.assetsEnabled) {
                const hasOutputAssets = assetArray.some((a) => {
                  const type = getAssetType(a)
                  return type === 'output' || type === 'temp'
                })
                const hasInputAssets = assetArray.some(
                  (a) => getAssetType(a) === 'input'
                )

                if (hasOutputAssets) {
                  await assetsStore.outputAssets.invalidate()
                }
                if (hasInputAssets) {
                  await assetsStore.inputAssets.invalidate()
                }
              }

              // Show appropriate feedback based on results
              if (failedCount === 0) {
                toast.add({
                  severity: 'success',
                  summary: t('g.success'),
                  detail: isSingle
                    ? t('mediaAsset.assetDeletedSuccessfully')
                    : t(
                        'mediaAsset.selection.assetsDeletedSuccessfully',
                        succeeded
                      ),
                  life: 2000
                })
              } else if (succeeded === 0) {
                toast.add({
                  severity: 'error',
                  summary: t('g.error'),
                  detail: isSingle
                    ? t('mediaAsset.failedToDeleteAsset')
                    : t('mediaAsset.selection.failedToDeleteAssets')
                })
              } else {
                // Partial success (only possible with multiple assets)
                toast.add({
                  severity: 'warn',
                  summary: t('g.warning'),
                  detail: t('mediaAsset.selection.partialDeleteSuccess', {
                    succeeded,
                    failed: failedCount
                  }),
                  life: 3000
                })
              }
            } catch (error) {
              console.error('Failed to delete assets:', error)
              toast.add({
                severity: 'error',
                summary: t('g.error'),
                detail: isSingle
                  ? t('mediaAsset.failedToDeleteAsset')
                  : t('mediaAsset.selection.failedToDeleteAssets')
              })
            } finally {
              // Hide loading overlay for all assets
              assetArray.forEach((asset) =>
                assetsStore.setAssetDeleting(asset.id, false)
              )
            }

            resolve(true)
          },
          onCancel: () => {
            resolve(false)
          }
        },
        dialogComponentProps: {
          renderer: 'reka',
          size: 'md'
        }
      })
    })
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
