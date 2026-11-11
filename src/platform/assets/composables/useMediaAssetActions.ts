import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  reconcileDeletedAssetReferences,
  useAssetEditorActions
} from '@/platform/assets/integration/assetEditorActions'
import { getOutputAssetMetadata } from '@/platform/assets/types/outputAssetMetadata'
import type { AssetItem } from '@comfyorg/assets-core/schema'
import { MediaAssetKey } from '@/platform/assets/composables/mediaAssetContext'
import { assetService } from '@/platform/assets/services/assetService'
import {
  buildAssetDeletionPlan,
  getDeletionNames,
  getDeletionOperationCount
} from '@/platform/assets/utils/assetDeletionPlan'
import type {
  AssetDeletion,
  DeleteOperation,
  JobDeletion
} from '@/platform/assets/utils/assetDeletionPlan'
import {
  buildAssetExportRequest,
  expandAssetsForDownload,
  hasGroupedAssetOutputs
} from '@/platform/assets/utils/assetExportPlan'
import {
  getAssetDisplayName,
  getAssetType
} from '@comfyorg/assets-core/metadata'
import { getAssetFileUrl } from '@/platform/assets/utils/assetUrlUtil'
import { getTotalAssetOutputCount } from '@/platform/assets/utils/outputAssetCountUtil'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useAssetsStore } from '@/platform/assets/stores/assetsStore'

import { useAssetDownload } from './useAssetDownload'
import type { AssetFileDownload } from '@/platform/assets/types/assetDownload'
import { useAssetZipExport } from './useAssetZipExport'

const EXCLUDED_TAGS = new Set(['models', 'input', 'output'])

export function useMediaAssetActions() {
  const { t } = useI18n()
  const toast = useToast()
  const assetsStore = useAssetsStore()
  const dialogService = useDialogService()
  const mediaContext = inject(MediaAssetKey, null)
  const { copyToClipboard } = useCopyToClipboard()
  const { flags } = useFeatureFlags()
  const { insertAssetLoader, openAssetWorkflow, exportAssetWorkflow } =
    useAssetEditorActions()
  const { downloadFiles } = useAssetDownload()
  const { startZipExport } = useAssetZipExport()

  const downloadAssets = (assets?: AssetItem[]) => {
    const targetAssets =
      assets ?? (mediaContext?.asset.value ? [mediaContext.asset.value] : [])
    if (targetAssets.length === 0) return

    const hasMultiOutputJobs = hasGroupedAssetOutputs(targetAssets)
    if (
      flags.assetsEnabled &&
      (targetAssets.length > 1 || hasMultiOutputJobs)
    ) {
      void startZipExport(
        buildAssetExportRequest(targetAssets),
        getTotalAssetOutputCount(targetAssets)
      )
      return
    }
    if (hasMultiOutputJobs) {
      void downloadAssetsIndividually(targetAssets)
      return
    }
    void downloadFiles(targetAssets.map(createAssetDownload))
  }

  function createAssetDownload(asset: AssetItem): AssetFileDownload {
    const url = getAssetFileUrl(asset)
    const filename = getAssetDisplayName(asset)
    if (!isCloud) return { mode: 'direct', url, filename }
    return {
      mode: 'fetch',
      url,
      filename,
      fetch: (route) => api.fetchApi(route)
    }
  }

  async function downloadAssetsIndividually(assets: AssetItem[]) {
    const expanded = await expandAssetsForDownload(assets)
    await downloadFiles(expanded.map(createAssetDownload))
  }

  const copyJobId = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return
    const metadata = getOutputAssetMetadata(targetAsset.user_metadata)
    const jobId =
      metadata?.jobId ||
      (getAssetType(targetAsset) === 'output' ? targetAsset.id : undefined)
    if (!jobId) {
      toast.warning(t('g.warning'), {
        description: t('mediaAsset.noJobIdFound'),
        duration: 2000
      })
      return
    }
    await copyToClipboard(jobId)
  }

  const addWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return
    const result = insertAssetLoader(targetAsset)
    if (result.kind === 'unsupported') {
      toast.warning(t('g.warning'), {
        description: t('mediaAsset.unsupportedFileType'),
        duration: 2000
      })
    } else if (result.kind === 'failed') {
      toast.error(t('g.error'), {
        description: t('mediaAsset.failedToCreateNode')
      })
    } else {
      toast.success(t('g.success'), {
        description: t('mediaAsset.nodeAddedToWorkflow', {
          nodeType: result.nodeType
        }),
        duration: 2000
      })
    }
  }

  const openWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return
    const result = await openAssetWorkflow(targetAsset)
    if (result.success) {
      toast.success(t('g.success'), {
        description: t('mediaAsset.workflowOpenedInNewTab'),
        duration: 2000
      })
      return
    }
    if (result.errorPresentation === 'handled') return
    toast.warning(t('g.warning'), {
      description: result.error || t('mediaAsset.noWorkflowDataFound'),
      duration: 2000
    })
  }

  const exportWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return
    const result = await exportAssetWorkflow(targetAsset)
    if (result.cancelled) return
    if (!result.success) {
      const kind = result.error?.includes('No workflow') ? 'warning' : 'error'
      toast[kind](t(`g.${kind}`), {
        description: result.error || t('mediaAsset.failedToExportWorkflow'),
        duration: 3000
      })
    } else {
      toast.success(t('g.success'), {
        description: t('mediaAsset.workflowExportedSuccessfully'),
        duration: 2000
      })
    }
  }

  const addMultipleToWorkflow = async (assets: AssetItem[]) => {
    let succeeded = 0
    let failed = 0
    for (const asset of assets) {
      const result = insertAssetLoader(asset, succeeded)
      if (result.kind === 'success') succeeded++
      else failed++
    }
    if (failed === 0) {
      toast.success(t('g.success'), {
        description: t('mediaAsset.selection.nodesAddedToWorkflow', {
          count: succeeded
        }),
        duration: 2000
      })
    } else if (succeeded === 0) {
      toast.error(t('g.error'), {
        description: t('mediaAsset.selection.failedToAddNodes')
      })
    } else {
      toast.warning(t('g.warning'), {
        description: t('mediaAsset.selection.partialAddNodesSuccess', {
          succeeded,
          failed
        }),
        duration: 3000
      })
    }
  }

  const openMultipleWorkflows = async (assets: AssetItem[]) => {
    let succeeded = 0
    let failed = 0
    let alreadyPresented = 0
    for (const asset of assets) {
      try {
        const result = await openAssetWorkflow(asset)
        if (result.success) succeeded++
        else {
          failed++
          if (result.errorPresentation === 'handled') alreadyPresented++
        }
      } catch {
        failed++
      }
    }
    if (failed === 0) {
      toast.success(t('g.success'), {
        description: t('mediaAsset.selection.workflowsOpened', {
          count: succeeded
        }),
        duration: 2000
      })
    } else if (succeeded === 0) {
      if (alreadyPresented !== failed)
        toast.warning(t('g.warning'), {
          description: t('mediaAsset.selection.noWorkflowsFound'),
          duration: 3000
        })
    } else {
      toast.warning(t('g.warning'), {
        description: t('mediaAsset.selection.partialWorkflowsOpened', {
          succeeded,
          failed
        }),
        duration: 3000
      })
    }
  }

  const exportMultipleWorkflows = async (assets: AssetItem[]) => {
    let succeeded = 0
    let failed = 0
    for (const asset of assets) {
      try {
        const result = await exportAssetWorkflow(asset)
        if (result.success) succeeded++
        else if (!result.cancelled) failed++
      } catch {
        failed++
      }
    }
    if (succeeded === 0 && failed === 0) return
    if (failed === 0) {
      toast.success(t('g.success'), {
        description: t('mediaAsset.selection.workflowsExported', {
          count: succeeded
        }),
        duration: 2000
      })
    } else if (succeeded === 0) {
      toast.warning(t('g.warning'), {
        description: t('mediaAsset.selection.noWorkflowsToExport'),
        duration: 3000
      })
    } else {
      toast.warning(t('g.warning'), {
        description: t('mediaAsset.selection.partialWorkflowsExported', {
          succeeded,
          failed
        }),
        duration: 3000
      })
    }
  }

  async function deleteAssets(input: AssetItem[] | AssetItem) {
    const assets = Array.isArray(input) ? input : [input]
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

    const deletionPlan = buildAssetDeletionPlan(assets, {
      assetsEnabled: flags.assetsEnabled
    })
    if (!deletionPlan.length) return false
    const plannedAssetCount = getDeletionOperationCount('asset', deletionPlan)
    const plannedJobCount = getDeletionOperationCount('job', deletionPlan)
    const deleteConfirmed = await dialogService.confirm({
      title: t('mediaAsset.deleteItems'),
      type: 'delete',
      message: !plannedAssetCount
        ? t('mediaAsset.deleteHistoryOnly')
        : flags.assetDeletionEnabled
          ? t('mediaAsset.deletePermanent')
          : t('mediaAsset.deleteTombstone'),
      itemList: deletionPlan.flatMap(getDeletionNames)
    })
    if (!deleteConfirmed) return false
    const failedDeletions = (
      await Promise.all(deletionPlan.map(performDelete))
    ).flat()

    reconcileDeletedAssetReferences(deletedVariants)
    for (const category of invalidatedModelTags)
      assetsStore.invalidateModelsForCategory(category)
    if (!flags.assetsEnabled) {
      const hasOutputAssets = assets.some((asset) => {
        const type = getAssetType(asset)
        return type === 'output' || type === 'temp'
      })
      const hasInputAssets = assets.some(
        (asset) => getAssetType(asset) === 'input'
      )
      if (hasOutputAssets) await assetsStore.outputAssets.invalidate()
      if (hasInputAssets) await assetsStore.inputAssets.invalidate()
    }
    const outcome =
      failedDeletions.length === 0
        ? 'success'
        : deletedJobCount || deletedAssetCount
          ? 'warning'
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
    toast[outcome](t(`mediaAsset.assetDelete.${outcome}`), {
      description: resultMessages.join('\n'),
      duration: outcome === 'success' ? 2000 : 5000
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
