<template>
  <ButtonGroup
    class="queue-button-group h-8 rounded-lg bg-secondary-background"
  >
    <BatchCountEdit />
    <Button
      :tooltip="queueButtonTooltip"
      tooltip-side="bottom"
      :variant="queueButtonVariant"
      size="unset"
      :class="
        cn(
          'h-full gap-1.5 rounded-l-lg rounded-r-none px-4',
          paymentRecoveryLock ? 'font-medium' : 'font-light'
        )
      "
      data-testid="queue-button"
      @click="queuePrompt"
    >
      <i :class="cn(iconClass, 'size-4')" data-testid="queue-button-icon" />
      {{ queueButtonLabel }}
    </Button>

    <Menu side="bottom" :side-offset="4" class="min-w-44">
      <template #trigger>
        <Button
          :variant="queueMenuTriggerVariant"
          size="unset"
          :disabled="Boolean(paymentRecoveryLock)"
          :class="
            cn(
              queueMenuTriggerClass,
              queueMenuTriggerVariantClass[queueMenuTriggerVariant]
            )
          "
          :aria-label="t('menu.runOptions')"
          data-testid="queue-mode-menu-trigger"
        >
          <TinyChevronIcon />
        </Button>
      </template>
      <MenuRadioGroup
        :model-value="selectedQueueMode"
        :options="queueModeMenuItems"
        @select.prevent
      />
    </Menu>
  </ButtonGroup>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountEdit from '@/components/actionbar/BatchCountEdit.vue'
import TinyChevronIcon from '@/components/actionbar/TinyChevronIcon.vue'
import Button from '@/components/ui/button/Button.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import MenuRadioGroup from '@/components/ui/menu/MenuRadioGroup.vue'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import {
  isInstantMode,
  isInstantRunningMode,
  useQueueSettingsStore
} from '@/stores/queueSettingsStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

const workspaceStore = useWorkspaceStore()
const { mode: queueMode, batchCount } = storeToRefs(useQueueSettingsStore())
const { hasMissingError } = storeToRefs(useExecutionErrorStore())

const { t } = useI18n()
type QueueModeMenuKey = 'disabled' | 'change' | 'instant-idle'
type PaymentRecoveryLock = 'owner' | 'member'

const { paymentRecoveryLock = null } = defineProps<{
  paymentRecoveryLock?: PaymentRecoveryLock | null
}>()
const emit = defineEmits<{
  paymentRecoveryClick: []
}>()

watch(
  () => paymentRecoveryLock,
  (lock) => {
    if (lock) queueMode.value = 'disabled'
  },
  { immediate: true }
)

interface QueueModeMenuItem {
  value: QueueModeMenuKey
  label: string
  tooltip: string
  command: () => void
}

const selectedQueueMode = computed<QueueModeMenuKey>(() =>
  isInstantMode(queueMode.value) ? 'instant-idle' : queueMode.value
)

const queueModeMenuItemLookup = computed<Record<string, QueueModeMenuItem>>(
  () => {
    const items: Record<string, QueueModeMenuItem> = {
      disabled: {
        value: 'disabled',
        label: t('menu.run'),
        tooltip: t('menu.disabledTooltip'),
        command: () => {
          queueMode.value = 'disabled'
        }
      },
      change: {
        value: 'change',
        label: `${t('menu.run')} (${t('menu.onChange')})`,
        tooltip: t('menu.onChangeTooltip'),
        command: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'queue_mode_option_run_on_change_selected',
            element_group: 'queue'
          })
          queueMode.value = 'change'
        }
      }
    }

    if (!isCloud) {
      items['instant-idle'] = {
        value: 'instant-idle',
        label: `${t('menu.run')} (${t('menu.instant')})`,
        tooltip: t('menu.instantTooltip'),
        command: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'queue_mode_option_run_instant_selected',
            element_group: 'queue'
          })
          queueMode.value = 'instant-idle'
        }
      }
    }

    return items
  }
)

const activeQueueModeMenuItem = computed(() => {
  return (
    queueModeMenuItemLookup.value[selectedQueueMode.value] ||
    queueModeMenuItemLookup.value.disabled
  )
})
const queueModeMenuItems = computed(() =>
  Object.values(queueModeMenuItemLookup.value)
)

const isStopInstantAction = computed(() =>
  isInstantRunningMode(queueMode.value)
)

const queueButtonLabel = computed(() =>
  paymentRecoveryLock === 'owner'
    ? t('subscription.paymentRecovery.ownerRunLabel')
    : paymentRecoveryLock === 'member'
      ? t('subscription.paymentRecovery.memberRunLabel')
      : isStopInstantAction.value
        ? t('menu.stopRunInstant')
        : String(activeQueueModeMenuItem.value?.label ?? '')
)

const queueButtonVariant = computed<
  'destructive' | 'inverted' | 'secondary' | 'subscribe'
>(() =>
  paymentRecoveryLock === 'owner'
    ? 'subscribe'
    : paymentRecoveryLock === 'member'
      ? 'secondary'
      : isStopInstantAction.value
        ? 'destructive'
        : 'inverted'
)
const queueMenuTriggerVariant = computed(() =>
  queueButtonVariant.value === 'subscribe'
    ? 'secondary'
    : queueButtonVariant.value
)
const queueMenuTriggerVariantClass = {
  destructive:
    'border-black/20 data-[state=open]:bg-destructive-background-hover',
  inverted: 'data-[state=open]:bg-base-foreground/80',
  secondary: 'text-muted-foreground'
} satisfies Record<typeof queueMenuTriggerVariant.value, string>
const queueMenuTriggerClass =
  'h-full w-6 rounded-l-none rounded-r-lg border-0 border-l border-solid border-current/25 p-0'

const iconClass = computed(() => {
  if (paymentRecoveryLock) {
    return 'icon-[lucide--lock]'
  }
  if (isStopInstantAction.value) {
    return 'icon-[lucide--square]'
  }
  if (hasMissingError.value) {
    return 'icon-[lucide--triangle-alert]'
  }
  if (workspaceStore.shiftDown) {
    return 'icon-[lucide--list-start]'
  }
  if (queueMode.value === 'disabled') {
    return 'icon-[lucide--play]'
  }
  if (isInstantMode(queueMode.value)) {
    return 'icon-[lucide--fast-forward]'
  }
  if (queueMode.value === 'change') {
    return 'icon-[lucide--step-forward]'
  }
  return 'icon-[lucide--play]'
})

const queueButtonTooltip = computed(() => {
  if (paymentRecoveryLock === 'owner') {
    return t('subscription.paymentRecovery.ownerRunTooltip')
  }
  if (paymentRecoveryLock === 'member') {
    return t('subscription.paymentRecovery.memberRunTooltip')
  }
  if (isStopInstantAction.value) {
    return t('menu.stopRunInstantTooltip')
  }
  if (hasMissingError.value) {
    return t('menu.runWorkflowMissingResources')
  }
  if (workspaceStore.shiftDown) {
    return t('menu.runWorkflowFront')
  }
  return t('menu.runWorkflow')
})

const commandStore = useCommandStore()
const queuePrompt = async (e: Event) => {
  if (paymentRecoveryLock) {
    emit('paymentRecoveryClick')
    return
  }
  if (isStopInstantAction.value) {
    queueMode.value = 'instant-idle'
    return
  }

  const isShiftPressed = 'shiftKey' in e && e.shiftKey
  const commandId = isShiftPressed
    ? 'Comfy.QueuePromptFront'
    : 'Comfy.QueuePrompt'

  if (isInstantMode(queueMode.value)) {
    queueMode.value = 'instant-running'
  }

  if (batchCount.value > 1) {
    useTelemetry()?.trackUiButtonClicked({
      button_id: 'queue_run_multiple_batches_submitted',
      element_group: 'queue'
    })
  }

  await commandStore.execute(commandId, {
    metadata: {
      subscribe_to_run: false,
      trigger_source: 'button'
    }
  })
}
</script>
