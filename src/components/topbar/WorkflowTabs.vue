<template>
  <div
    :class="
      cn(
        'workflow-tabs-container flex h-full flex-auto flex-row gap-1 overflow-hidden bg-background px-1',
        isDesktop ? 'max-w-[env(titlebar-area-width,100vw)]' : 'max-w-full'
      )
    "
  >
    <div
      ref="tabStripRef"
      data-testid="workflow-tab-strip"
      class="no-drag scrollbar-thin scrollbar-thumb-smoke-500/50 scrollbar-track-transparent overflow-x-auto overflow-y-hidden"
      @wheel="handleWheel"
      @transitionend="handleTabResize"
    >
      <Tabs
        class="h-full"
        :model-value="workflowStore.activeWorkflow?.path ?? ''"
        activation-mode="manual"
        @update:model-value="openWorkflowByPath"
      >
        <TabsList
          :class="cn('workflow-tabs h-full flex-nowrap gap-1', props.class)"
        >
          <WorkflowTab
            v-for="(option, index) in options"
            :key="option.value"
            :workflow-option="option"
            :is-first="index === 0"
            :is-last="index === options.length - 1"
            :compact="isOverflowing"
            @click.middle="onCloseWorkflow(option)"
            @close-to-left="closeWorkflows(options.slice(0, index))"
            @close-to-right="closeWorkflows(options.slice(index + 1))"
            @close-others="
              closeWorkflows([
                ...options.slice(index + 1),
                ...options.slice(0, index)
              ])
            "
          />
        </TabsList>
      </Tabs>
    </div>
    <WorkflowOverflowMenu
      v-if="isOverflowing"
      :workflows="workflowStore.openWorkflows"
      :active-workflow="workflowStore.activeWorkflow"
    />
    <Button
      :tooltip="$t('sideToolbar.newBlankWorkflow')"
      class="new-blank-workflow-button no-drag shrink-0 self-center"
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('sideToolbar.newBlankWorkflow')"
      @click="() => commandStore.execute('Comfy.NewBlankWorkflow')"
    >
      <i class="pi pi-plus" />
    </Button>
    <WorkflowTabBarActions />
    <div
      v-if="isDesktop"
      class="window-actions-spacer app-drag min-w-[min(75px,env(titlebar-area-width,0)*9999)] flex-auto shrink-0"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import WorkflowTab from '@/components/topbar/WorkflowTab.vue'
import WorkflowTabBarActions from '@/components/topbar/WorkflowTabBarActions.vue'

import Button from '@/components/ui/button/Button.vue'
import Tabs from '@comfyorg/design-system/tabs/Tabs'
import TabsList from '@comfyorg/design-system/tabs/TabsList'
import { useWorkflowStatusDismissal } from '@/composables/useWorkflowStatusDismissal'
import { useOverflowObserver } from '@/composables/element/useOverflowObserver'
import { isDesktop } from '@/platform/distribution/types'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import WorkflowOverflowMenu from './WorkflowOverflowMenu.vue'

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const props = defineProps<{
  class?: string
}>()

const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const commandStore = useCommandStore()

useWorkflowStatusDismissal()

const tabStripRef = ref<HTMLElement | null>(null)

const options = computed<WorkflowOption[]>(() =>
  workflowStore.openWorkflows.map((workflow) => ({
    value: workflow.path,
    workflow
  }))
)

async function openWorkflowByPath(path: string | number) {
  const option = options.value.find(({ value }) => value === path)
  if (!option) return
  await workflowService.openWorkflow(option.workflow)
}

const closeWorkflows = async (options: WorkflowOption[]) => {
  for (const opt of options) {
    if (
      !(await workflowService.closeWorkflow(opt.workflow, {
        warnIfUnsaved: !workspaceStore.shiftDown
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

const WHEEL_LINE_HEIGHT_PX = 16

function handleWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) return
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
  event.preventDefault()
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? WHEEL_LINE_HEIGHT_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? (tabStripRef.value?.clientWidth ?? 0)
        : 1
  tabStripRef.value?.scrollBy({ left: event.deltaY * unit })
}

async function revealActiveTab() {
  await nextTick()
  tabStripRef.value
    ?.querySelector('[role="tab"][aria-selected="true"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

const { isOverflowing, checkOverflow } = useOverflowObserver(tabStripRef, {
  useResizeObserver: false
})

useResizeObserver(tabStripRef, () => {
  checkOverflow()
  void revealActiveTab()
})

watch(
  () => workflowStore.activeWorkflow,
  async () => {
    await revealActiveTab()
    checkOverflow()
  },
  { immediate: true }
)

function handleTabResize(event: TransitionEvent) {
  if (event.propertyName !== 'flex-shrink') return
  checkOverflow()
  void revealActiveTab()
}
</script>
