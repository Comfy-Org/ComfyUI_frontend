import { computed } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import type { JobListItem } from '@/composables/queue/useJobList'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { st } from '@/i18n'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ResultItem, ResultItemType } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useQueueStore } from '@/stores/queueStore'
import type { ResultItemImpl } from '@/stores/queueStore'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'

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
 * Popover visibility is managed by the caller; actions do not close UI.
 *
 * TODO: The following placeholders intentionally have no handlers and will be implemented soon:
 * - Download
 * - Export workflow
 * - Delete
 * - Copy error message
 * - Report error
 */
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

  const openJobWorkflow = async () => {
    const item = currentMenuItem()
    if (!item) return
    const data = item.taskRef?.workflow
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
    } else if (item.state === 'queued') {
      await api.deleteItem('queue', item.id)
    }
    await queueStore.update()
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
    const state = currentMenuItem()?.state
    if (!state) return []
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
          onClick: undefined
        },
        { kind: 'divider', key: 'd2' },
        {
          key: 'copy-id',
          label: jobMenuCopyJobIdLabel.value,
          icon: 'icon-[lucide--copy]',
          onClick: copyJobId
        },
        { kind: 'divider', key: 'd3' },
        {
          key: 'delete',
          label: st('queue.jobMenu.deleteAsset', 'Delete asset'),
          icon: 'icon-[lucide--trash-2]',
          onClick: undefined
        }
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
          onClick: undefined
        },
        {
          key: 'report-error',
          label: st('queue.jobMenu.reportError', 'Report error'),
          icon: 'icon-[lucide--message-circle-warning]',
          onClick: undefined
        },
        { kind: 'divider', key: 'd2' },
        {
          key: 'delete',
          label: st('queue.jobMenu.removeJob', 'Remove job'),
          icon: 'icon-[lucide--circle-minus]',
          onClick: undefined
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
