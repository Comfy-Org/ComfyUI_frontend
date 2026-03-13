<template>
  <ButtonGroup
    class="queue-button-group h-8 rounded-lg bg-secondary-background"
  >
    <BatchCountEdit />
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
      <i :class="cn(iconClass, 'size-4')" />
      {{ queueButtonLabel }}
    </Button>

    <DropdownMenu>
      <template #button>
        <Button
          variant="secondary"
          size="unset"
          :class="queueMenuTriggerClass"
          :aria-label="t('menu.run')"
          data-testid="queue-mode-menu-trigger"
        >
          <TinyChevronIcon />
        </Button>
      </template>
      <template #default="{ itemClass }">
        <DropdownMenuItem
          v-for="item in queueModeMenuItems"
          :key="item.key"
          as-child
          @select.prevent="item.command"
        >
          <Button
            v-tooltip="{
              value: item.tooltip,
              showDelay: 600
            }"
            :variant="item.key === selectedQueueMode ? 'primary' : 'secondary'"
            size="sm"
            :class="cn(itemClass, queueMenuItemButtonClass)"
          >
            {{ item.label }}
          </Button>
        </DropdownMenuItem>
        <DropdownMenuSeparator
          v-if="isParallelToggleVisible"
          class="m-1 h-px bg-border-subtle"
        />
        <DropdownMenuItem
          v-if="isParallelToggleVisible"
          :class="itemClass"
          :disabled="isParallelToggleDisabled"
          @select.prevent="toggleParallel"
        >
          <div class="flex flex-col select-none">
            <div class="flex items-center gap-1.5">
              <span class="text-sm text-text-primary">{{
                t('menu.parallelExecution')
              }}</span>
              <StatusBadge :label="t('g.new')" class="text-[10px]" />
            </div>
            <span class="text-text-muted text-xs">{{
              t('menu.parallelUpTo', { count: maxConcurrentJobs })
            }}</span>
          </div>
          <SwitchRoot
            :checked="parallelToggleChecked"
            :disabled="isParallelToggleDisabled"
            class="relative ml-auto h-5 w-9 shrink-0 cursor-pointer rounded-full bg-secondary-background transition-colors data-disabled:cursor-not-allowed data-[state=checked]:bg-primary-background"
            @click.stop
            @update:checked="onParallelToggle"
          >
            <SwitchThumb
              class="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]"
            />
          </SwitchRoot>
        </DropdownMenuItem>
      </template>
    </DropdownMenu>
  </ButtonGroup>
</template>

<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  SwitchRoot,
  SwitchThumb
} from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import BatchCountEdit from '@/components/actionbar/BatchCountEdit.vue'
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TinyChevronIcon from '@/components/actionbar/TinyChevronIcon.vue'
import Button from '@/components/ui/button/Button.vue'
import ButtonGroup from '@/components/ui/button-group/ButtonGroup.vue'
import { useConcurrentExecution } from '@/composables/useConcurrentExecution'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  isInstantMode,
  isInstantRunningMode,
  useQueueSettingsStore
} from '@/stores/queueStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { cn } from '@/utils/tailwindUtil'
import { graphHasMissingNodes } from '@/workbench/extensions/manager/utils/graphHasMissingNodes'

const workspaceStore = useWorkspaceStore()
const { mode: queueMode, batchCount } = storeToRefs(useQueueSettingsStore())

const nodeDefStore = useNodeDefStore()
const hasMissingNodes = computed(() =>
  graphHasMissingNodes(app.rootGraph, nodeDefStore.nodeDefsByName)
)

const { t } = useI18n()
type QueueModeMenuKey = 'disabled' | 'change' | 'instant-idle'

interface QueueModeMenuItem {
  key: QueueModeMenuKey
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
        key: 'disabled',
        label: t('menu.run'),
        tooltip: t('menu.disabledTooltip'),
        command: () => {
          queueMode.value = 'disabled'
        }
      },
      change: {
        key: 'change',
        label: `${t('menu.run')} (${t('menu.onChange')})`,
        tooltip: t('menu.onChangeTooltip'),
        command: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'queue_mode_option_run_on_change_selected'
          })
          queueMode.value = 'change'
        }
      }
    }

    if (!isCloud) {
      items['instant-idle'] = {
        key: 'instant-idle',
        label: `${t('menu.run')} (${t('menu.instant')})`,
        tooltip: t('menu.instantTooltip'),
        command: () => {
          useTelemetry()?.trackUiButtonClicked({
            button_id: 'queue_mode_option_run_instant_selected'
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
  isStopInstantAction.value
    ? t('menu.stopRunInstant')
    : String(activeQueueModeMenuItem.value?.label ?? '')
)

const queueButtonVariant = computed<'destructive' | 'primary'>(() =>
  isStopInstantAction.value ? 'destructive' : 'primary'
)
const queueActionButtonClass = 'h-full rounded-lg gap-1.5 px-4 font-light'
const queueMenuTriggerClass =
  'h-full w-6 rounded-l-none rounded-r-lg border-l border-border-subtle p-0 text-muted-foreground data-[state=open]:bg-secondary-background-hover'
const queueMenuItemButtonClass = 'w-full justify-start font-normal'

const iconClass = computed(() => {
  if (isStopInstantAction.value) {
    return 'icon-[lucide--square]'
  }
  if (hasMissingNodes.value) {
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
  if (isStopInstantAction.value) {
    return t('menu.stopRunInstantTooltip')
  }
  if (hasMissingNodes.value) {
    return t('menu.runWorkflowDisabled')
  }
  if (workspaceStore.shiftDown) {
    return t('menu.runWorkflowFront')
  }
  return t('menu.runWorkflow')
})

const { isFeatureEnabled, isUserEnabled, maxConcurrentJobs, setUserEnabled } =
  useConcurrentExecution()

const isParallelToggleVisible = isFeatureEnabled
const isParallelToggleDisabled = computed(
  () => selectedQueueMode.value !== 'disabled'
)
const parallelToggleChecked = isUserEnabled

function onParallelToggle(checked: boolean) {
  void setUserEnabled(checked)
}

function toggleParallel() {
  onParallelToggle(!parallelToggleChecked.value)
}

const commandStore = useCommandStore()
const queuePrompt = async (e: Event) => {
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
      button_id: 'queue_run_multiple_batches_submitted'
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
