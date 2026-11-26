import { computed } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import type { JobListItem } from '@/platform/queue/presentation/queueDisplay'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { useJobErrorReporting } from '@/platform/queue/composables/useJobErrorReporting'
import { st, t } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { withNodeAddSource } from '@/platform/telemetry/nodeAdded/nodeAddSource'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ResultItem } from '@comfyorg/api-client/executionTypes'
import { api } from '@/scripts/api'
import { downloadBlob } from '@/scripts/utils'
import { useDialogService } from '@/services/dialogService'
import { getJobWorkflow } from '@/platform/queue/services/jobOutputCache'
import { useLitegraphService } from '@/services/litegraphService'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useQueueStore } from '@/platform/queue/stores/queueStore'
import type { TaskItemImpl } from '@comfyorg/api-client/jobs/taskItem'
import type { AugmentedResultItem } from '@comfyorg/api-client/results/resultItem'
import { resultItemUrl } from '@/utils/resultItemUrl'
import {
  isAudioResult,
  isImageResult,
  isVideoResult
} from '@comfyorg/api-client/results/resultItem'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { appendJsonExt } from '@/utils/formatUtil'
import { isResultItemType } from '@/utils/typeGuardUtil'

export function useJobMenu(
  currentMenuItem: () => JobListItem | null = () => null,
  onInspectAsset?: (item: JobListItem) => void
) {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const queueStore = useQueueStore()
  const executionStore = useExecutionStore()
  const { copyToClipboard } = useCopyToClipboard()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()
  const { reportJobError } = useJobErrorReporting({
    taskForJob: computed(() => currentMenuItem()?.taskRef ?? null),
    copyToClipboard,
    dialog: useDialogService()
  })

  const resolveItem = (item?: JobListItem | null): JobListItem | null =>
    item ?? currentMenuItem()

  const openJobWorkflow = async (item?: JobListItem | null) => {
    const target = resolveItem(item)
    if (!target) return
    const data = await getJobWorkflow(target.id)
    if (!data) return
    const filename = `Job ${target.id}.json`
    const temp = workflowStore.createTemporary(filename, data)
    try {
      await workflowService.openWorkflow(temp, { initiator: 'user' })
    } catch (error) {
      useDialogService().showErrorDialog(error, {
        title: t('errorDialog.queueOpenWorkflowFailedTitle'),
        reportType: 'queueOpenWorkflowError'
      })
    }
  }

  const copyJobId = async (item?: JobListItem | null) => {
    const target = resolveItem(item)
    if (!target) return
    await copyToClipboard(target.id)
  }

  const cancelJob = async (item?: JobListItem | null) => {
    const target = resolveItem(item)
    if (!target) return
    if (
      target.state === 'running' ||
      target.state === 'initialization' ||
      target.state === 'pending'
    ) {
      await api.cancelJob(target.id)
    }
    executionStore.clearInitializationByJobId(target.id)
    await queueStore.update()
  }

  const copyErrorMessage = async (item?: JobListItem | null) => {
    const target = resolveItem(item)
    const message = target?.taskRef?.errorMessage
    if (message) await copyToClipboard(message)
  }

  const addOutputLoaderNode = async () => {
    const item = currentMenuItem()
    if (!item) return
    const result: AugmentedResultItem | undefined = item.taskRef?.previewOutput
    if (!result) return

    let nodeType: 'LoadImage' | 'LoadVideo' | 'LoadAudio' | null = null
    let widgetName: 'image' | 'file' | 'audio' | null = null
    if (isImageResult(result)) {
      nodeType = 'LoadImage'
      widgetName = 'image'
    } else if (isVideoResult(result)) {
      nodeType = 'LoadVideo'
      widgetName = 'file'
    } else if (isAudioResult(result)) {
      nodeType = 'LoadAudio'
      widgetName = 'audio'
    }
    if (!nodeType || !widgetName) return

    const nodeDef = Object.hasOwn(nodeDefStore.nodeDefsByName, nodeType)
      ? nodeDefStore.nodeDefsByName[nodeType]
      : undefined
    if (!nodeDef) return
    const node = withNodeAddSource('programmatic', () =>
      litegraphService.addNodeOnGraph(nodeDef, {
        pos: litegraphService.getCanvasCenter()
      })
    )

    if (!node) return

    const apiItem: ResultItem = {
      filename: result.filename,
      subfolder: result.subfolder,
      type: isResultItemType(result.type) ? result.type : 'output'
    }

    const annotated = createAnnotatedPath(apiItem)
    const widget = node.widgets?.find((w) => w.name === widgetName)
    if (widget) {
      widget.value = annotated
      widget.callback?.(annotated)
    }
    node.graph?.setDirtyCanvas(true, true)
  }

  const downloadPreviewAsset = () => {
    const item = currentMenuItem()
    if (!item) return
    const result: AugmentedResultItem | undefined = item.taskRef?.previewOutput
    if (!result) return
    downloadFile(resultItemUrl(result), undefined, 'job_menu')
  }

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
        message: t('workflowService.enterFilenamePrompt'),
        defaultValue: filename
      })
      if (!input) return
      filename = appendJsonExt(input)
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    downloadBlob(filename, blob)
  }

  const removeFailedJob = async (task?: TaskItemImpl | null) => {
    const target = task ?? currentMenuItem()?.taskRef
    if (!target) return
    await queueStore.delete(target)
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

  const jobMenuEntries = computed<MenuItem[]>(() => {
    const item = currentMenuItem()
    const state = item?.state
    if (!state) return []
    const hasPreviewAsset = !!item.taskRef?.previewOutput
    if (state === 'completed') {
      return handleErrors([
        {
          key: 'inspect-asset',
          label: st('queue.jobMenu.inspectAsset', 'Inspect asset'),
          icon: 'icon-[lucide--zoom-in]',
          disabled: !hasPreviewAsset || !onInspectAsset,
          command: onInspectAsset
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
          disabled: !hasPreviewAsset,
          command: () => addOutputLoaderNode()
        },
        {
          key: 'download',
          label: st('queue.jobMenu.download', 'Download'),
          icon: 'icon-[lucide--download]',
          disabled: !hasPreviewAsset,
          command: () => downloadPreviewAsset()
        },
        { separator: true, key: 'd1' },
        {
          key: 'open-workflow',
          label: jobMenuOpenWorkflowLabel.value,
          icon: 'icon-[comfy--workflow]',
          command: () => openJobWorkflow()
        },
        {
          key: 'export-workflow',
          label: st('queue.jobMenu.exportWorkflow', 'Export workflow'),
          icon: 'icon-[comfy--file-output]',
          command: () => exportJobWorkflow()
        },
        { separator: true, key: 'd2' },
        {
          key: 'copy-id',
          label: jobMenuCopyJobIdLabel.value,
          icon: 'icon-[lucide--copy]',
          command: () => copyJobId()
        }
      ])
    }
    if (state === 'failed') {
      return handleErrors([
        {
          key: 'open-workflow',
          label: jobMenuOpenWorkflowFailedLabel.value,
          icon: 'icon-[comfy--workflow]',
          command: () => openJobWorkflow()
        },
        { separator: true, key: 'd1' },
        {
          key: 'copy-id',
          label: jobMenuCopyJobIdLabel.value,
          icon: 'icon-[lucide--copy]',
          command: () => copyJobId()
        },
        {
          key: 'copy-error',
          label: st('queue.jobMenu.copyErrorMessage', 'Copy error message'),
          icon: 'icon-[lucide--copy]',
          command: () => copyErrorMessage()
        },
        {
          key: 'report-error',
          label: st('queue.jobMenu.reportError', 'Report error'),
          icon: 'icon-[lucide--message-circle-warning]',
          command: () => reportJobError()
        },
        { separator: true, key: 'd2' },
        {
          key: 'delete',
          label: st('queue.jobMenu.removeJob', 'Remove job'),
          icon: 'icon-[lucide--circle-minus]',
          command: () => removeFailedJob()
        }
      ])
    }
    return handleErrors([
      {
        key: 'open-workflow',
        label: jobMenuOpenWorkflowLabel.value,
        icon: 'icon-[comfy--workflow]',
        command: () => openJobWorkflow()
      },
      { separator: true, key: 'd1' },
      {
        key: 'copy-id',
        label: jobMenuCopyJobIdLabel.value,
        icon: 'icon-[lucide--copy]',
        command: () => copyJobId()
      },
      { separator: true, key: 'd2' },
      {
        key: 'cancel-job',
        label: jobMenuCancelLabel.value,
        icon: 'icon-[lucide--x]',
        command: () => cancelJob()
      }
    ])
  })

  const handleErrors = (items: MenuItem[]): MenuItem[] =>
    items.map((item) =>
      item.command
        ? { ...item, command: wrapWithErrorHandlingAsync(item.command) }
        : item
    )

  return {
    jobMenuEntries,
    openJobWorkflow,
    copyJobId,
    cancelJob,
    removeFailedJob
  }
}
