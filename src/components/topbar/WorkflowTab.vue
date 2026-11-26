<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child>
      <div
        ref="workflowTabRef"
        data-testid="workflow-tab"
        :class="
          cn(
            'workflow-tab group/tab relative h-full min-w-22.5 motion-safe:transition-[flex-shrink] motion-safe:duration-200 motion-safe:ease-out',
            isActiveTab ? 'shrink-0' : 'shrink'
          )
        "
        v-bind="$attrs"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
        @click="handleClick"
      >
        <TabsTrigger
          :value="workflowOption.workflow.path"
          as-child
          class="h-full w-full gap-0 px-2 py-2"
        >
          <button
            :id="resolvedTriggerId"
            type="button"
            :aria-description="popoverStatusDescription"
          >
            <span class="flex-1" />
            <span class="inline-flex min-w-0 items-center gap-2">
              <template v-if="showModeIcon">
                <i
                  v-if="isBuilderState"
                  data-testid="workflow-mode-icon"
                  class="order-first icon-[lucide--hammer] bg-muted-foreground"
                />
                <i
                  v-else-if="workflowOption.workflow.initialMode === 'app'"
                  data-testid="workflow-mode-icon"
                  class="order-first icon-[lucide--panels-top-left] bg-primary"
                />
              </template>
              <span
                class="workflow-label inline-block max-w-[150px] truncate font-inter text-sm leading-none font-normal text-inherit"
              >
                {{ workflowOption.workflow.filename }}
              </span>
              <WorkflowTabStatus
                class="order-first"
                :status="primaryStatus"
                :reserve-space="false"
              />
              <span class="size-4 shrink-0" />
            </span>
            <span class="@container/close-space relative flex-1 self-stretch">
              <span
                v-if="shouldShowUnsavedIndicator"
                data-testid="workflow-dirty-indicator"
                :class="
                  cn(
                    'absolute top-1/2 right-full z-10 mr-1 size-2 -translate-y-1/2 rounded-full @max-[0.75rem]/close-space:group-focus-within/tab:invisible @max-[0.75rem]/close-space:group-hover/tab:invisible',
                    isActiveTab ? 'bg-foreground' : 'bg-muted-foreground'
                  )
                "
              />
            </span>
          </button>
        </TabsTrigger>
        <Button
          :class="
            cn(
              'close-button absolute top-1/2 right-2 size-4 -translate-y-1/2 rounded-none p-0 group-focus-within/tab:visible group-hover/tab:visible',
              closeButtonVisibility
            )
          "
          variant="muted-textonly"
          size="unset"
          :aria-label="t('g.close')"
          data-testid="close-workflow-button"
          @click.stop="onCloseWorkflow(workflowOption)"
        >
          <i data-testid="close-workflow-icon" class="icon-[lucide--x]" />
        </Button>
      </div>
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-56">
      <MenuItems :items="contextMenuItems" />
    </ContextMenuContent>
  </ContextMenuRoot>
  <WorkflowTabPopover
    v-model:open="popoverOpen"
    v-model:clicked="popoverClicked"
    :anchor="workflowTabRef"
    :hovered="popoverHovered"
    :focused="popoverFocusPreview"
    :workflow-filename="workflowOption.workflow.filename"
    :thumbnail-url="thumbnailUrl"
    :is-active-tab="isActiveTab"
    :statuses="popoverStatuses"
  />
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import MenuItems from '@comfyorg/design-system/menu/MenuItems'
import ContextMenuContent from '@comfyorg/design-system/menu/ContextMenuContent'
import TabsTrigger from '@comfyorg/design-system/tabs/TabsTrigger'
import {
  usePragmaticDraggable,
  usePragmaticDroppable
} from '@/composables/usePragmaticDragAndDrop'
import { useWorkflowActionsMenu } from '@/composables/useWorkflowActionsMenu'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowThumbnail } from '@/renderer/core/thumbnail/useWorkflowThumbnail'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { WorkflowMenuItem } from '@/types/workflowMenuItem'
import { cn } from '@comfyorg/tailwind-utils'

import {
  TAB_POPOVER_STATUS_I18N_KEYS,
  resolvePrimaryTabStatus,
  resolveTabPopoverStatuses
} from './workflowTabStatus'
import WorkflowTabPopover from './WorkflowTabPopover.vue'
import WorkflowTabStatus from './WorkflowTabStatus.vue'

defineOptions({ inheritAttrs: false })

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const {
  workflowOption,
  isFirst,
  isLast,
  compact = false,
  triggerId
} = defineProps<{
  workflowOption: WorkflowOption
  isFirst: boolean
  isLast: boolean
  compact?: boolean
  triggerId?: string
}>()

const emit = defineEmits<{
  closeToLeft: []
  closeToRight: []
  closeOthers: []
}>()

const { t } = useI18n()

const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const settingStore = useSettingStore()
const executionStore = useExecutionStore()
const tabActivity = useWorkflowTabActivityStore()
const workflowTabRef = ref<HTMLElement | null>(null)
const fallbackTriggerId = `workflow-tab-trigger-${useId()}`
const resolvedTriggerId = computed(() => triggerId ?? fallbackTriggerId)
const popoverOpen = ref(false)
const popoverHovered = ref(false)
const popoverFocused = ref(false)
const popoverClicked = ref(false)
const workflowThumbnail = useWorkflowThumbnail()

// Use computed refs to cache autosave settings
const autoSaveSetting = computed(() =>
  settingStore.get('Comfy.Workflow.AutoSave')
)
const autoSaveDelay = computed(() =>
  settingStore.get('Comfy.Workflow.AutoSaveDelay')
)

const shouldShowUnsavedIndicator = computed(() => {
  if (workspaceStore.shiftDown) {
    // Branch 1: Shift key is held down, do not show the status indicator.
    return false
  }
  if (!workflowOption.workflow.isPersisted) {
    // Branch 2: Workflow is not persisted, show the status indicator.
    return true
  }
  if (workflowOption.workflow.isModified) {
    // Branch 3: Workflow is modified.
    if (autoSaveSetting.value === 'off') {
      // Sub-branch 3a: Autosave is off, so show the status indicator.
      return true
    }
    if (autoSaveSetting.value === 'after delay' && autoSaveDelay.value > 3000) {
      // Sub-branch 3b: Autosave delay is too high, so show the status indicator.
      return true
    }
    // Sub-branch 3c: Workflow is modified but no condition applies, do not show the status indicator.
    return false
  }
  // Default: do not show the status indicator. This should not be reachable.
  return false
})

const isBuilderState = computed(() => {
  const currentMode = workflowOption.workflow.activeMode
  return typeof currentMode === 'string' && currentMode.startsWith('builder:')
})

const isActiveTab = computed(() => {
  return workflowStore.isActive(workflowOption.workflow)
})

const showModeIcon = computed(() => !compact || isActiveTab.value)

const workflowStatus = computed(() =>
  isActiveTab.value
    ? undefined
    : executionStore.getWorkflowStatus(workflowOption.workflow)
)

const statusSignals = computed(() => {
  const path = workflowOption.workflow.path
  return {
    awaitingApproval: tabActivity.awaitingApprovalPaths.has(path),
    agentWorking: tabActivity.editingPaths.has(path),
    agentReplied: tabActivity.unseenModifiedPaths.has(path),
    workflowStatus: workflowStatus.value,
    unsaved: shouldShowUnsavedIndicator.value
  }
})

const primaryStatus = computed(() =>
  resolvePrimaryTabStatus(statusSignals.value)
)

const popoverStatuses = computed(() =>
  isActiveTab.value ? [] : resolveTabPopoverStatuses(statusSignals.value)
)

const popoverStatusDescription = computed(() =>
  popoverStatuses.value.length > 0
    ? popoverStatuses.value
        .map((status) => t(TAB_POPOVER_STATUS_I18N_KEYS[status]))
        .join(', ')
    : undefined
)

const popoverFocusPreview = computed(
  () => popoverFocused.value && popoverStatuses.value.length > 0
)

const closeButtonVisibility = computed(() =>
  isActiveTab.value && !shouldShowUnsavedIndicator.value
    ? 'visible'
    : 'invisible'
)

const thumbnailUrl = computed(() => {
  return workflowThumbnail.getThumbnail(workflowOption.workflow.key)
})

const handleMouseEnter = () => {
  popoverClicked.value = false
  popoverHovered.value = true
}

const handleMouseLeave = () => {
  popoverHovered.value = false
}

const handleFocusIn = () => {
  popoverClicked.value = false
  popoverFocused.value = true
}

const handleFocusOut = (event: FocusEvent) => {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && workflowTabRef.value?.contains(nextTarget))
    return
  popoverFocused.value = false
}

useEventListener(workflowTabRef, 'focusin', handleFocusIn)
useEventListener(workflowTabRef, 'focusout', handleFocusOut)

const handleClick = () => {
  if (!popoverOpen.value) popoverClicked.value = true
  popoverOpen.value = !popoverOpen.value
}

const onCloseWorkflow = (option: WorkflowOption) =>
  useWorkflowService().closeWorkflows([option.workflow], {
    warnIfUnsaved: !workspaceStore.shiftDown,
    hint: t('sideToolbar.workflowTab.dirtyCloseHint'),
    initiator: 'user'
  })

const commandStore = useCommandStore()
const workflow = computed(() => workflowOption.workflow)

const { menuItems: baseMenuItems } = useWorkflowActionsMenu(
  () => commandStore.execute('Comfy.RenameWorkflow'),
  { includeDelete: false, workflow }
)

const contextMenuItems = computed<WorkflowMenuItem[]>(() => [
  ...baseMenuItems.value,
  { separator: true },
  {
    id: 'close-tab',
    label: t('tabMenu.closeTab'),
    icon: 'icon-[lucide--x]',
    command: () => onCloseWorkflow(workflowOption)
  },
  {
    id: 'close-tabs-to-left',
    label: t('tabMenu.closeTabsToLeft'),
    overlayIcon: {
      mainIcon: 'icon-[lucide--x]',
      subIcon: 'icon-[lucide--arrow-left]',
      positionX: 'right',
      positionY: 'bottom',
      subIconScale: 0.5
    },
    command: () => emit('closeToLeft'),
    disabled: isFirst
  },
  {
    id: 'close-tabs-to-right',
    label: t('tabMenu.closeTabsToRight'),
    overlayIcon: {
      mainIcon: 'icon-[lucide--x]',
      subIcon: 'icon-[lucide--arrow-right]',
      positionX: 'right',
      positionY: 'bottom',
      subIconScale: 0.5
    },
    command: () => emit('closeToRight'),
    disabled: isLast
  },
  {
    id: 'close-other-tabs',
    label: t('tabMenu.closeOtherTabs'),
    overlayIcon: {
      mainIcon: 'icon-[lucide--x]',
      subIcon: 'icon-[lucide--move-horizontal]',
      positionX: 'right',
      positionY: 'bottom',
      subIconScale: 0.5
    },
    command: () => emit('closeOthers'),
    disabled: isFirst && isLast
  }
])

const tabGetter = () => workflowTabRef.value as HTMLElement

usePragmaticDraggable(tabGetter, {
  getInitialData: () => {
    return {
      workflowKey: workflowOption.workflow.key
    }
  }
})

usePragmaticDroppable(tabGetter, {
  getData: () => {
    return {
      workflowKey: workflowOption.workflow.key
    }
  },
  onDrop: (e) => {
    const fromIndex = workflowStore.openWorkflows.findIndex(
      (wf) => wf.key === e.source.data.workflowKey
    )
    const toIndex = workflowStore.openWorkflows.findIndex(
      (wf) => wf.key === e.location.current.dropTargets[0]?.data.workflowKey
    )
    if (fromIndex !== toIndex) {
      workflowStore.reorderWorkflows(fromIndex, toIndex)
    }
  }
})
</script>
