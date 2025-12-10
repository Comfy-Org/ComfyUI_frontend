import { computed } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { st, t } from '@/i18n'
import { mapTaskOutputToAssetItem } from '@/platform/assets/composables/media/assetMappers'
import { useMediaAssetActions } from '@/platform/assets/composables/useMediaAssetActions'
import {
  extractWorkflow,
  fetchJobDetail
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ResultItem, ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { downloadBlob } from '@/scripts/utils'
import { useDialogService } from '@/services/dialogService'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl, TaskItemImpl } from '@/stores/queueStore'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { appendJsonExt } from '@/utils/formatUtil'

export type MenuEntry =
  | {
      kind?: 'item'
      key: string
      label: string
      icon?: string
      onClick?: () => void | Promise<void>
    }
  | { kind: 'divider'; key: string }

/**
 * Provides job context menu entries and actions.
 *
 * @param currentMenuItem Getter for the currently targeted job list item
 * @param onInspectAsset Callback to trigger when inspecting a completed job's asset
 */
export function useJobMenu(
  currentMenuItem: () => JobListItem | null,
  onInspectAsset?: (item: JobListItem) => void
) {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const queueStore = useQueueStore()
  const { copyToClipboard } = useCopyToClipboard()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()
  const mediaAssetActions = useMediaAssetActions()

  /**
   * Fetches workflow data for a job, lazy loading from API if needed.
   */
  const getJobWorkflow = async (
    jobId: string
  ): Promise<ComfyWorkflowJSON | undefined> => {
    const jobDetail = await fetchJobDetail((url) => api.fetchApi(url), jobId)
    return extractWorkflow(jobDetail)
  }

  const openJobWorkflow = async () => {
    const item = currentMenuItem()
    if (!item) return
    const data = await getJobWorkflow(item.id)
    if (!data) return
    const filename = `Job ${item.id}.json`
    const temp = workflowStore.createTemporary(filename, data)
    await workflowService.openWorkflow(temp)
  }

  const copyJobId = async () => {
    const item = currentMenuItem()
    if (!item) return
    await copyToClipboard(item.id)
  }

  const cancelJob = async () => {
    const item = currentMenuItem()
    if (!item) return
    if (item.state === 'running' || item.state === 'initialization') {
      await api.interrupt(item.id)
    } else if (item.state === 'pending') {
      await api.deleteItem('queue', item.id)
    }
    await queueStore.update()
  }

  const copyErrorMessage = async () => {
    const item = currentMenuItem()
    const message = item?.taskRef?.errorMessage
    if (message) await copyToClipboard(message)
  }

  const reportError = () => {
    const item = currentMenuItem()
    if (!item) return

    // Use execution_error from list response if available
    const executionError = item.taskRef?.executionError

    if (executionError) {
      useDialogService().showExecutionErrorDialog(executionError)
      return
    }

    // Fall back to simple error dialog
    const message = item.taskRef?.errorMessage
    if (message) {
      useDialogService().showErrorDialog(new Error(message), {
        reportType: 'queueJobError'
      })
    }
  }

  // This is very magical only because it matches the respective backend implementation
  // There is or will be a better way to do this
  const addOutputLoaderNode = async () => {
    const item = currentMenuItem()
    if (!item) return
    const result: ResultItemImpl | undefined = item.taskRef?.previewOutput
    if (!result) return

    let nodeType: 'LoadImage' | 'LoadVideo' | 'LoadAudio' | null = null
    let widgetName: 'image' | 'file' | 'audio' | null = null
    if (result.isImage) {
      nodeType = 'LoadImage'
      widgetName = 'image'
    } else if (result.isVideo) {
      nodeType = 'LoadVideo'
      widgetName = 'file'
    } else if (result.isAudio) {
      nodeType = 'LoadAudio'
      widgetName = 'audio'
    }
    if (!nodeType || !widgetName) return

    const nodeDef = nodeDefStore.nodeDefsByName[nodeType]
    if (!nodeDef) return
    const node = litegraphService.addNodeOnGraph(nodeDef, {
      pos: litegraphService.getCanvasCenter()
    })

    if (!node) return

    const isResultItemType = (v: string | undefined): v is ResultItemType =>
      v === 'input' || v === 'output' || v === 'temp'

    const apiItem: ResultItem = {
      filename: result.filename,
      subfolder: result.subfolder,
      type: isResultItemType(result.type) ? result.type : undefined
    }

    const annotated = createAnnotatedPath(apiItem, {
      rootFolder: apiItem.type
    })
    const widget = node.widgets?.find((w) => w.name === widgetName)
    if (widget) {
      widget.value = annotated
      widget.callback?.(annotated)
    }
    node.graph?.setDirtyCanvas(true, true)
  }

  /**
   * Trigger a download of the job's previewable output asset.
   */
  const downloadPreviewAsset = () => {
    const item = currentMenuItem()
    if (!item) return
    const result: ResultItemImpl | undefined = item.taskRef?.previewOutput
    if (!result) return
    downloadFile(result.url)
  }

  /**
   * Export the workflow JSON attached to the job.
   */
  const exportJobWorkflow = async () => {
    const item = currentMenuItem()
    if (!item) return
    const data = await getJobWorkflow(item.id)
    if (!data) return

    const settingStore = useSettingStore()
    let filename = `Job ${item.id}.json`

    if (settingStore.get('Comfy.PromptFilename')) {
      const input = await useDialogService().prompt({
        title: t('workflowService.exportWorkflow'),
        message: t('workflowService.enterFilename') + ':',
        defaultValue: filename
      })
      if (!input) return
      filename = appendJsonExt(input)
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(filename, blob)
  }

  const deleteJobAsset = async () => {
    const item = currentMenuItem()
    if (!item) return
    const task = item.taskRef as TaskItemImpl | undefined
    const preview = task?.previewOutput
    if (!task || !preview) return

    const asset = mapTaskOutputToAssetItem(task, preview)
    const success = await mediaAssetActions.confirmDelete(asset)
    if (success) {
      await queueStore.update()
    }
  }

  const removeFailedJob = async () => {
    const task = currentMenuItem()?.taskRef as TaskItemImpl | undefined
    if (!task) return
    await queueStore.delete(task)
  }

  const jobMenuOpenWorkflowLabel = computed(() =>
    st('queue.jobMenu.openAsWorkflowNewTab', 'Open as workflow in new tab')
  )
  const jobMenuOpenWorkflowFailedLabel = computed(() =>
    st('queue.jobMenu.openWorkflowNewTab', 'Open workflow in new tab')
  )
  const jobMenuCopyJobIdLabel = computed(() =>
    st('queue.jobMenu.copyJobId', 'Copy job ID')
  )
  const jobMenuCancelLabel = computed(() =>
    st('queue.jobMenu.cancelJob', 'Cancel job')
  )

  const jobMenuEntries = computed<MenuEntry[]>(() => {
    const item = currentMenuItem()
    const state = item?.state
    if (!state) return []
    const hasDeletableAsset = !!item?.taskRef?.previewOutput
    if (state === 'completed') {
      return [
        {
          key: 'inspect-asset',
          label: st('queue.jobMenu.inspectAsset', 'Inspect asset'),
          icon: 'icon-[lucide--zoom-in]',
          onClick: onInspectAsset
            ? () => {
                const item = currentMenuItem()
                if (item) onInspectAsset(item)
              }
            : undefined
        },
        {
          key: 'add-to-current',
          label: st(
            'queue.jobMenu.addToCurrentWorkflow',
            'Add to current workflow'
          ),
          icon: 'icon-[comfy--node]',
          onClick: addOutputLoaderNode
        },
        {
          key: 'download',
          label: st('queue.jobMenu.download', 'Download'),
          icon: 'icon-[lucide--download]',
          onClick: downloadPreviewAsset
        },
        { kind: 'divider', key: 'd1' },
        {
          key: 'open-workflow',
          label: jobMenuOpenWorkflowLabel.value,
          icon: 'icon-[comfy--workflow]',
          onClick: openJobWorkflow
        },
        {
          key: 'export-workflow',
          label: st('queue.jobMenu.exportWorkflow', 'Export workflow'),
          icon: 'icon-[comfy--file-output]',
          onClick: exportJobWorkflow
        },
        { kind: 'divider', key: 'd2' },
        {
          key: 'copy-id',
          label: jobMenuCopyJobIdLabel.value,
          icon: 'icon-[lucide--copy]',
          onClick: copyJobId
        },
        { kind: 'divider', key: 'd3' },
        ...(hasDeletableAsset
          ? [
              {
                key: 'delete',
                label: st('queue.jobMenu.deleteAsset', 'Delete asset'),
                icon: 'icon-[lucide--trash-2]',
                onClick: deleteJobAsset
              }
            ]
          : [])
      ]
    }
    if (state === 'failed') {
      return [
        {
          key: 'open-workflow',
          label: jobMenuOpenWorkflowFailedLabel.value,
          icon: 'icon-[comfy--workflow]',
          onClick: openJobWorkflow
        },
        { kind: 'divider', key: 'd1' },
        {
          key: 'copy-id',
          label: jobMenuCopyJobIdLabel.value,
          icon: 'icon-[lucide--copy]',
          onClick: copyJobId
        },
        {
          key: 'copy-error',
          label: st('queue.jobMenu.copyErrorMessage', 'Copy error message'),
          icon: 'icon-[lucide--copy]',
          onClick: copyErrorMessage
        },
        {
          key: 'report-error',
          label: st('queue.jobMenu.reportError', 'Report error'),
          icon: 'icon-[lucide--message-circle-warning]',
          onClick: reportError
        },
        { kind: 'divider', key: 'd2' },
        {
          key: 'delete',
          label: st('queue.jobMenu.removeJob', 'Remove job'),
          icon: 'icon-[lucide--circle-minus]',
          onClick: removeFailedJob
        }
      ]
    }
    return [
      {
        key: 'open-workflow',
        label: jobMenuOpenWorkflowLabel.value,
        icon: 'icon-[comfy--workflow]',
        onClick: openJobWorkflow
      },
      { kind: 'divider', key: 'd1' },
      {
        key: 'copy-id',
        label: jobMenuCopyJobIdLabel.value,
        icon: 'icon-[lucide--copy]',
        onClick: copyJobId
      },
      { kind: 'divider', key: 'd2' },
      {
        key: 'cancel-job',
        label: jobMenuCancelLabel.value,
        icon: 'icon-[lucide--x]',
        onClick: cancelJob
      }
    ]
  })

  return {
    jobMenuEntries,
    openJobWorkflow,
    copyJobId,
    cancelJob
  }
}
