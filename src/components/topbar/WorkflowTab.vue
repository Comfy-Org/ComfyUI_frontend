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
          class="h-full w-full py-2 pr-2 pl-3"
        >
          <template v-if="showModeIcon">
            <i
              v-if="isBuilderState"
              data-testid="workflow-mode-icon"
              class="icon-[lucide--hammer] bg-muted-foreground"
            />
            <i
              v-else-if="workflowOption.workflow.initialMode === 'app'"
              data-testid="workflow-mode-icon"
              class="icon-[lucide--panels-top-left] bg-primary-background"
            />
          </template>
          <WorkflowAgentTargetIndicator
            :workflow-path="workflowOption.workflow.path"
          />
          <span
            class="workflow-label inline-block max-w-[150px] truncate font-inter text-sm leading-none font-normal text-inherit"
          >
            {{ workflowOption.workflow.filename }}
          </span>
          <span
            :class="
              cn(
                'relative size-4 shrink-0 group-focus-within/tab:invisible',
                revealsCloseOnHover && 'group-hover/tab:invisible'
              )
            "
          >
            <i
              v-if="isAgentEditing"
              role="img"
              :aria-label="t('g.agentWorking')"
              class="absolute top-1/2 left-1/2 z-10 icon-[lucide--loader-circle] size-4 -translate-1/2 text-smoke-800 motion-safe:animate-spin"
            />
            <span
              v-else-if="showUnseenAgentDot"
              role="img"
              :aria-label="t('g.agentModified')"
              data-testid="agent-modified-indicator"
              class="absolute top-1/2 left-1/2 z-10 size-2 -translate-1/2 rounded-full bg-primary-background"
            />
            <i
              v-else-if="workflowStatus"
              role="img"
              :aria-label="workflowStatusLabel"
              :class="
                cn(
                  'absolute top-1/2 left-1/2 z-10 size-4 -translate-1/2',
                  workflowStatusIconClasses[workflowStatus]
                )
              "
            />
            <span
              v-else-if="shouldShowUnsavedIndicator"
              data-testid="workflow-dirty-indicator"
              :class="
                cn(
                  'absolute top-1/2 left-1/2 z-10 size-2 -translate-1/2 rounded-full',
                  isActiveTab ? 'bg-base-foreground' : 'bg-smoke-800'
                )
              "
            />
          </span>
        </TabsTrigger>
        <Button
          :class="
            cn(
              'close-button absolute top-1/2 right-2 size-4 -translate-y-1/2 rounded-none p-0 text-smoke-800 group-focus-within/tab:visible',
              isActiveTab && !hasStatusIndicator ? 'visible' : 'invisible',
              revealsCloseOnHover && 'group-hover/tab:visible'
            )
          "
          variant="muted-textonly"
          size="unset"
          :aria-label="t('g.close')"
          data-testid="close-workflow-button"
          @click.stop="onCloseWorkflow(workflowOption)"
        >
          <i
            data-testid="close-workflow-icon"
            class="icon-[lucide--x] size-4"
          />
        </Button>
        <WorkflowTabPopover
          ref="popoverRef"
          :workflow-filename="workflowOption.workflow.filename"
          :thumbnail-url="thumbnailUrl"
          :is-active-tab="isActiveTab"
        />
      </div>
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        class="z-1000 min-w-56 rounded-lg border border-border-subtle bg-base-background px-2 py-3 shadow-interface"
      >
        <WorkflowActionsList
          :items="contextMenuItems"
          :item-component="ContextMenuItem"
          :separator-component="ContextMenuSeparator"
        />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkflowActionsList from '@/components/common/WorkflowActionsList.vue'
import Button from '@/components/ui/button/Button.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
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
import { useCommandStore } from '@/stores/commandStore'
import type { WorkflowExecutionStatus } from '@/stores/executionStore'
import {
  useExecutionStore,
  WORKFLOW_STATUS_I18N_KEYS
} from '@/stores/executionStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { WorkflowMenuItem } from '@/types/workflowMenuItem'
import { cn } from '@comfyorg/tailwind-utils'

import WorkflowTabPopover from './WorkflowTabPopover.vue'
import WorkflowAgentTargetIndicator from './WorkflowAgentTargetIndicator.vue'

defineOptions({ inheritAttrs: false })

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const props = defineProps<{
  workflowOption: WorkflowOption
  isFirst: boolean
  isLast: boolean
  compact?: boolean
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
const workflowTabRef = ref<HTMLElement | null>(null)
const popoverRef = ref<InstanceType<typeof WorkflowTabPopover> | null>(null)
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
  if (!props.workflowOption.workflow.isPersisted) {
    // Branch 2: Workflow is not persisted, show the status indicator.
    return true
  }
  if (props.workflowOption.workflow.isModified) {
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
  const currentMode = props.workflowOption.workflow.activeMode
  return typeof currentMode === 'string' && currentMode.startsWith('builder:')
})

const isActiveTab = computed(() => {
  return workflowStore.isActive(props.workflowOption.workflow)
})

const showModeIcon = computed(() => !props.compact || isActiveTab.value)

const workflowStatusIconClasses: Record<WorkflowExecutionStatus, string> = {
  running:
    'text-base-foreground icon-[lucide--loader-circle] motion-safe:animate-spin',
  completed: 'icon-[lucide--circle-check] text-success-background',
  failed: 'icon-[lucide--octagon-alert] text-destructive-background'
}

const tabActivity = useWorkflowTabActivityStore()

const isAgentEditing = computed(
  () => tabActivity.editingTabPath === props.workflowOption.workflow.path
)

// The active tab doesn't badge its own status - the user is already looking
// at it. Background tabs surface the recorded execution status.
const workflowStatus = computed(() =>
  isActiveTab.value
    ? undefined
    : executionStore.getWorkflowStatus(props.workflowOption.workflow)
)

// A failed run outranks the unseen-changes dot so the failure isn't masked.
const showUnseenAgentDot = computed(
  () =>
    tabActivity.unseenModifiedPaths.has(props.workflowOption.workflow.path) &&
    workflowStatus.value !== 'failed'
)

const workflowStatusLabel = computed(() =>
  workflowStatus.value
    ? t(WORKFLOW_STATUS_I18N_KEYS[workflowStatus.value])
    : undefined
)

const revealsCloseOnHover = computed(() => isActiveTab.value || !props.compact)

const hasStatusIndicator = computed(
  () =>
    isAgentEditing.value ||
    showUnseenAgentDot.value ||
    workflowStatus.value !== undefined ||
    shouldShowUnsavedIndicator.value
)

const thumbnailUrl = computed(() => {
  return workflowThumbnail.getThumbnail(props.workflowOption.workflow.key)
})

// Event handlers that delegate to the popover component
const handleMouseEnter = (event: Event) => {
  popoverRef.value?.showPopover(event)
}

const handleMouseLeave = () => {
  popoverRef.value?.hidePopover()
}

const handleClick = (event: Event) => {
  popoverRef.value?.togglePopover(event)
}

const closeWorkflows = async (options: WorkflowOption[]) => {
  for (const opt of options) {
    if (
      !(await useWorkflowService().closeWorkflow(opt.workflow, {
        warnIfUnsaved: !workspaceStore.shiftDown,
        hint: t('sideToolbar.workflowTab.dirtyCloseHint')
      }))
    ) {
      // User cancelled, or the replacement load failed
      break
    }
  }
}

const onCloseWorkflow = async (option: WorkflowOption) => {
  await closeWorkflows([option])
}

const commandStore = useCommandStore()
const workflow = computed(() => props.workflowOption.workflow)

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
    icon: 'pi pi-times',
    command: () => onCloseWorkflow(props.workflowOption)
  },
  {
    id: 'close-tabs-to-left',
    label: t('tabMenu.closeTabsToLeft'),
    overlayIcon: {
      mainIcon: 'pi pi-times',
      subIcon: 'pi pi-arrow-left',
      positionX: 'right',
      positionY: 'bottom',
      subIconScale: 0.5
    },
    command: () => emit('closeToLeft'),
    disabled: props.isFirst
  },
  {
    id: 'close-tabs-to-right',
    label: t('tabMenu.closeTabsToRight'),
    overlayIcon: {
      mainIcon: 'pi pi-times',
      subIcon: 'pi pi-arrow-right',
      positionX: 'right',
      positionY: 'bottom',
      subIconScale: 0.5
    },
    command: () => emit('closeToRight'),
    disabled: props.isLast
  },
  {
    id: 'close-other-tabs',
    label: t('tabMenu.closeOtherTabs'),
    overlayIcon: {
      mainIcon: 'pi pi-times',
      subIcon: 'pi pi-arrows-h',
      positionX: 'right',
      positionY: 'bottom',
      subIconScale: 0.5
    },
    command: () => emit('closeOthers'),
    disabled: props.isFirst && props.isLast
  }
])

const tabGetter = () => workflowTabRef.value as HTMLElement

usePragmaticDraggable(tabGetter, {
  getInitialData: () => {
    return {
      workflowKey: props.workflowOption.workflow.key
    }
  }
})

usePragmaticDroppable(tabGetter, {
  getData: () => {
    return {
      workflowKey: props.workflowOption.workflow.key
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

onUnmounted(() => {
  popoverRef.value?.hidePopover()
})
</script>
