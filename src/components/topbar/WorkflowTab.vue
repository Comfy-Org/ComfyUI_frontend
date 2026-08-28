<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child>
      <div
        ref="workflowTabRef"
        data-testid="workflow-tab"
        class="workflow-tab group box-border flex h-(--workflow-tabs-height) items-center justify-center gap-2 px-4 py-2"
        v-bind="$attrs"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
        @mouseup="handleMouseUp"
        @click="handleClick"
      >
        <i v-if="isBuilderState" class="bg-text-subtle icon-[lucide--hammer]" />
        <i
          v-else-if="workflowOption.workflow.initialMode === 'app'"
          class="icon-[lucide--panels-top-left] bg-primary-background"
        />
        <span
          class="workflow-label inline-block max-w-[150px] truncate text-sm font-normal"
        >
          {{ workflowOption.workflow.filename }}
        </span>
        <div class="relative size-5 shrink-0">
          <i
            v-if="workflowStatus"
            role="img"
            :aria-label="workflowStatusLabel"
            :class="
              cn(
                'absolute top-1/2 left-1/2 z-10 size-4 -translate-1/2 group-hover:hidden',
                workflowStatusIconClasses[workflowStatus]
              )
            "
          />
          <span
            v-else-if="shouldShowUnsavedIndicator"
            data-testid="workflow-dirty-indicator"
            :data-active="isActiveTab"
            class="absolute top-1/2 left-1/2 z-10 flex size-4 -translate-1/2 items-center justify-center bg-(--comfy-menu-bg) group-hover:hidden"
          >
            <span
              :class="
                cn(
                  'size-2 rounded-full',
                  isActiveTab ? 'bg-white' : 'bg-smoke-800'
                )
              "
            />
          </span>
          <Button
            class="close-button invisible rounded-none text-smoke-800 group-hover:visible"
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('g.close')"
            @click.stop="onCloseWorkflow(workflowOption)"
          >
            <i
              data-testid="close-workflow-icon"
              class="icon-[lucide--x] size-4"
            />
          </Button>
        </div>
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

  <WorkflowTabPopover
    ref="popoverRef"
    :workflow-filename="workflowOption.workflow.filename"
    :thumbnail-url="thumbnailUrl"
    :is-active-tab="isActiveTab"
  />
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
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { WorkflowMenuItem } from '@/types/workflowMenuItem'
import { cn } from '@comfyorg/tailwind-utils'

import WorkflowTabPopover from './WorkflowTabPopover.vue'

defineOptions({ inheritAttrs: false })

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const props = defineProps<{
  workflowOption: WorkflowOption
  isFirst: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  closeToLeft: []
  closeToRight: []
  closeOthers: []
  mouseup: [event: MouseEvent]
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

const workflowStatusIconClasses: Record<WorkflowExecutionStatus, string> = {
  running:
    'text-base-foreground icon-[lucide--loader-circle] motion-safe:animate-spin',
  completed: 'icon-[lucide--circle-check] text-success-background',
  failed: 'icon-[lucide--octagon-alert] text-destructive-background'
}

// The active tab doesn't badge its own status - the user is already looking
// at it. Background tabs surface the recorded execution status.
const workflowStatus = computed(() =>
  isActiveTab.value
    ? undefined
    : executionStore.getWorkflowStatus(props.workflowOption.workflow)
)

const workflowStatusLabel = computed(() =>
  workflowStatus.value
    ? t(WORKFLOW_STATUS_I18N_KEYS[workflowStatus.value])
    : undefined
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

const handleMouseUp = (event: MouseEvent) => {
  emit('mouseup', event)
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

<style>
.p-tooltip.workflow-tab-tooltip {
  z-index: 1200 !important;
}
</style>
