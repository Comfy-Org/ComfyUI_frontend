import type { ComfyCommand } from '@comfyorg/keybindings/commandStore'
import { useTelemetry } from '@comfyorg/telemetry'
import type { ExecutionTriggerSource } from '@comfyorg/telemetry/types'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useRunButtonTelemetry } from '@/composables/useRunButtonTelemetry'
import { t } from '@/i18n'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSubscriptionPaywall } from '@/platform/billing/composables/useSubscriptionPaywall'
import { isSalesManagedTier } from '@/platform/billing/subscription/constants/tierPricing'
import { subscribeToRunDialogOptions } from '@/platform/billing/subscription/utils/subscribeToRunDialogOptions'
import { isCloud } from '@/platform/distribution/types'
import { useQueueSettingsStore } from '@/platform/queue/stores/queueSettingsStore'
import {
  useQueueStore,
  useQueueUIStore
} from '@/platform/queue/stores/queueStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useUnreadyDeploymentRun } from '@/platform/workspace/composables/useUnreadyDeploymentRun'
import { api } from '@/scripts/api'
import { useApp } from '@/scripts/appInstance'
import { useExecutionStore } from '@/stores/executionStore'
import { getExecutionIdsForSelectedNodes } from '@/utils/graphTraversalUtil'
import { filterOutputNodes } from '@/utils/nodeFilterUtil'

export function useQueueCommands(
  isPickingNodes: () => boolean
): ComfyCommand[] {
  const {
    canAccessSubscriptionFeatures,
    subscription,
    subscriptionState,
    isInitialized,
    initialize,
    type: billingType
  } = useBillingContext()
  const { showSubscriptionDialog } = useSubscriptionPaywall()
  const toast = useToast()
  const executionStore = useExecutionStore()
  const { trackRunButton } = useRunButtonTelemetry()
  const { getSelectedNodes } = useSelectedLiteGraphItems()
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const { openSwitcherInsteadOfRun } = useUnreadyDeploymentRun()

  function activeWorkflowTarget(): readonly unknown[] {
    return [workflowStore.activeWorkflow]
  }

  function selectedNodesTarget(): readonly unknown[] {
    return [workflowStore.activeWorkflow, ...getSelectedNodes()]
  }

  async function deploymentStopsRun(
    runTarget: () => readonly unknown[]
  ): Promise<boolean> {
    if (isPickingNodes()) return false
    const asked = runTarget()
    return openSwitcherInsteadOfRun(() => {
      if (isPickingNodes()) return false
      const now = runTarget()
      return (
        asked.length === now.length &&
        asked.every((item, index) => item === now[index])
      )
    })
  }

  async function blockRunWithoutSubscription(): Promise<boolean> {
    if (!isCloud) return false
    if (!isInitialized.value) await initialize().catch(() => undefined)
    if (billingType.value === 'unknown') return true
    if (canAccessSubscriptionFeatures.value) return false
    if (isSalesManagedTier(subscription.value?.tier)) {
      toast.warning(t('subscription.salesManagedRunBlockedTitle'), {
        description: t('subscription.salesManagedRunBlockedDetail'),
        duration: 5000
      })
    } else {
      showSubscriptionDialog(
        subscribeToRunDialogOptions({
          subscriptionState: subscriptionState.value,
          hasFunds: subscription.value?.hasFunds
        })
      )
    }
    return true
  }

  const commands: ComfyCommand[] = [
    {
      id: 'Comfy.Interrupt',
      icon: 'icon-[lucide--square]',
      label: 'Interrupt',
      category: 'essentials',
      function: async (metadata?: Record<string, unknown>) => {
        const requestedJobId = metadata?.jobId
        const jobId =
          typeof requestedJobId === 'string' && requestedJobId.length > 0
            ? requestedJobId
            : executionStore.activeJobId
        await api.interrupt(jobId)
        toast.info(t('g.interrupted'), {
          description: t('toastMessages.interrupted'),
          duration: 1000
        })
      }
    },
    {
      id: 'Comfy.ClearPendingTasks',
      icon: 'icon-[lucide--square]',
      label: 'Clear Pending Tasks',
      category: 'essentials',
      function: async () => {
        if (!(await useQueueStore().clear(['queue']))) {
          toast.error(t('queue.failedToClearJobs'))
          return
        }
        toast.info(t('g.confirmed'), {
          description: t('toastMessages.pendingTasksDeleted'),
          duration: 3000
        })
      }
    },
    {
      id: 'Comfy.Queue.ToggleOverlay',
      icon: 'icon-[lucide--history]',
      label: () => t('queue.toggleJobHistory'),
      menubarLabel: () => t('queue.jobHistory'),
      versionAdded: '1.37.0',
      category: 'view-controls',
      function: () => {
        useQueueUIStore().toggleOverlay()
      },
      active: () => useQueueUIStore().isOverlayExpanded
    },
    {
      id: 'Comfy.QueuePrompt',
      icon: 'icon-[lucide--play]',
      label: 'Queue Prompt',
      versionAdded: '1.3.7',
      category: 'essentials',
      function: async (metadata?: {
        subscribe_to_run?: boolean
        trigger_source?: ExecutionTriggerSource
      }) => {
        if (await deploymentStopsRun(activeWorkflowTarget)) return
        trackRunButton(metadata)
        if (await blockRunWithoutSubscription()) return

        const batchCount = useQueueSettingsStore().batchCount

        useTelemetry()?.trackWorkflowExecution()

        await useApp().queuePrompt(0, batchCount, { intent: metadata })
      }
    },
    {
      id: 'Comfy.QueuePromptFront',
      icon: 'icon-[lucide--play]',
      label: 'Queue Prompt (Front)',
      versionAdded: '1.3.7',
      category: 'essentials',
      function: async (metadata?: {
        subscribe_to_run?: boolean
        trigger_source?: ExecutionTriggerSource
      }) => {
        if (await deploymentStopsRun(activeWorkflowTarget)) return
        trackRunButton(metadata)
        if (await blockRunWithoutSubscription()) return

        const batchCount = useQueueSettingsStore().batchCount

        useTelemetry()?.trackWorkflowExecution()

        await useApp().queuePrompt(-1, batchCount, { intent: metadata })
      }
    },
    {
      id: 'Comfy.QueueSelectedOutputNodes',
      icon: 'icon-[lucide--play]',
      label: 'Queue Selected Output Nodes',
      versionAdded: '1.19.6',
      function: async (metadata?: {
        subscribe_to_run?: boolean
        trigger_source?: ExecutionTriggerSource
      }) => {
        if (await deploymentStopsRun(selectedNodesTarget)) return
        trackRunButton(metadata)
        if (await blockRunWithoutSubscription()) return

        const batchCount = useQueueSettingsStore().batchCount
        const selectedNodes = getSelectedNodes()
        const selectedOutputNodes = filterOutputNodes(selectedNodes)

        if (selectedOutputNodes.length === 0) {
          toast.error(t('toastMessages.nothingToQueue'), {
            description: t('toastMessages.pleaseSelectOutputNodes')
          })
          return
        }

        const executionIds =
          getExecutionIdsForSelectedNodes(selectedOutputNodes)

        if (executionIds.length === 0) {
          toast.error(t('toastMessages.failedToQueue'), {
            description: t('toastMessages.failedExecutionPathResolution')
          })
          return
        }
        useTelemetry()?.trackWorkflowExecution()
        await useApp().queuePrompt(0, batchCount, {
          queueNodeIds: executionIds,
          intent: metadata
        })
      }
    },
    {
      id: 'Comfy.ToggleQPOV2',
      icon: 'icon-[lucide--list]',
      label: 'Toggle Queue Panel V2',
      function: async () => {
        await settingStore.set(
          'Comfy.Queue.QPOV2',
          !settingStore.get('Comfy.Queue.QPOV2')
        )
      }
    }
  ]

  return commands
}
