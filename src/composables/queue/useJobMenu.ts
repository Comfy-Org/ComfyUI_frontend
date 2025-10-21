import { computed } from 'vue'

import type { JobListItem } from '@/composables/queue/useJobList'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { st } from '@/i18n'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useQueueStore } from '@/stores/queueStore'

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
 * - Inspect asset
 * - Add to current workflow
 * - Download
 * - Export workflow
 * - Delete
 * - Copy error message
 * - Report error
 */
export function useJobMenu(currentMenuItem: () => JobListItem | null) {
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const queueStore = useQueueStore()
  const { copyToClipboard } = useCopyToClipboard()

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
          onClick: undefined
        },
        {
          key: 'add-to-current',
          label: st(
            'queue.jobMenu.addToCurrentWorkflow',
            'Add to current workflow'
          ),
          icon: 'icon-[comfy--node]',
          onClick: undefined
        },
        {
          key: 'download',
          label: st('queue.jobMenu.download', 'Download'),
          icon: 'icon-[lucide--download]',
          onClick: undefined
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
          label: st('queue.jobMenu.delete', 'Delete'),
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
          label: st('queue.jobMenu.delete', 'Delete'),
          icon: 'icon-[lucide--trash-2]',
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
