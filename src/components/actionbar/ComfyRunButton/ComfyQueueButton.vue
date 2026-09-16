<template>
  <div class="queue-run-controls flex h-8 items-center gap-1.5">
    <BatchCountEdit />
    <ButtonGroup class="queue-button-group h-full rounded-lg">
      <Button
        v-tooltip.bottom="{
          value: queueButtonTooltip,
          showDelay: 600
        }"
        :variant="queueButtonVariant"
        size="unset"
        :class="queueActionButtonClass"
        data-testid="queue-button"
        :data-variant="queueButtonVariant"
        @click="queuePrompt"
      >
        <i :class="cn(iconClass, 'size-4')" data-testid="queue-button-icon" />
        {{ queueButtonLabel }}
      </Button>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <Button
            variant="inverted"
            size="unset"
            :disabled="Boolean(paymentRecoveryLock)"
            :class="queueMenuTriggerClass"
            :aria-label="t('menu.runOptions')"
            data-testid="queue-mode-menu-trigger"
          >
            <i class="icon-[lucide--chevron-down] size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            :side-offset="4"
            class="z-1000 w-40 rounded-lg border border-border-subtle bg-base-background p-1 shadow-interface"
          >
            <DropdownMenuRadioGroup :model-value="selectedQueueMode">
              <DropdownMenuRadioItem
                v-for="item in queueModeMenuItems"
                :key="item.key"
                :value="item.key"
                as-child
                @select="item.command"
              >
                <Button
                  v-tooltip.bottom="
                    item.description ? buildModeInfoTooltip(item) : undefined
                  "
                  variant="textonly"
                  size="sm"
                  :class="
                    cn(
                      queueMenuItemButtonClass,
                      item.key === selectedQueueMode &&
                        'bg-secondary-background'
                    )
                  "
                >
                  <i :class="cn(item.icon, 'size-4 shrink-0')" />
                  <span class="mr-auto">{{ item.label }}</span>
                  <i
                    v-if="item.description"
                    class="icon-[lucide--info] size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Button>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </ButtonGroup>
  </div>
</template>

<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountEdit from '@/components/actionbar/BatchCountEdit.vue'
import Button from '@/components/ui/button/Button.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
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
  key: QueueModeMenuKey
  label: string
  icon: string
  tooltip: string
  description?: string
  command: () => void
}

const selectedQueueMode = computed<QueueModeMenuKey>(() =>
  isInstantMode(queueMode.value) ? 'instant-idle' : queueMode.value
)

const queueModeMenuItemLookup = computed<Record<string, QueueModeMenuItem>>(
  () => {
    const items: Record<string, QueueModeMenuItem> = {
      disabled: {
        key: 'disabled',
        label: t('menu.run'),
        icon: 'icon-[lucide--play]',
        tooltip: t('menu.disabledTooltip'),
        command: () => {
          queueMode.value = 'disabled'
        }
      },
      change: {
        key: 'change',
        label: t('menu.runOnChange'),
        icon: 'icon-[lucide--step-forward]',
        tooltip: t('menu.onChangeTooltip'),
        description: t('menu.onChangeDescription'),
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
        key: 'instant-idle',
        label: `${t('menu.run')} (${t('menu.instant')})`,
        icon: 'icon-[lucide--fast-forward]',
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

// i18n labels can come from custom nodes, so they are escaped for the HTML.
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char
  )

const buildModeInfoTooltip = (item: QueueModeMenuItem) => ({
  escape: false,
  showDelay: 150,
  hideDelay: 0,
  value: `<div class="text-sm font-semibold text-base-foreground">${escapeHtml(item.label)}</div><div class="mt-1 text-xs leading-snug text-muted-foreground">${escapeHtml(item.description ?? '')}</div>`,
  pt: {
    text: {
      class:
        'max-w-[280px] rounded-lg border border-border-subtle bg-base-background px-3 py-2 text-left shadow-interface'
    }
  }
})

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
const queueActionButtonClass =
  'h-full min-w-[88px] rounded-none gap-1.5 px-4 text-sm font-semibold'
const queueMenuTriggerClass =
  'h-full w-7 rounded-none border-solid border-y-0 border-r-0 border-l border-base-background/25 p-0 data-[state=open]:bg-base-foreground/80'
const queueMenuItemButtonClass =
  'w-full justify-start font-normal data-[highlighted]:bg-secondary-background-hover'

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
