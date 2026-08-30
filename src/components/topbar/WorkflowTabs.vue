<template>
  <div
    ref="containerRef"
    class="workflow-tabs-container flex h-full max-w-full flex-auto flex-row overflow-hidden"
    :class="{ 'workflow-tabs-container-desktop': isDesktop }"
  >
    <Button
      v-if="showOverflowArrows"
      variant="muted-textonly"
      size="icon"
      class="overflow-arrow overflow-arrow-left aspect-square h-full w-auto"
      :aria-label="$t('g.scrollLeft')"
      :disabled="!leftArrowEnabled"
      @mousedown="whileMouseDown($event, () => scroll(-1))"
    >
      <i class="icon-[lucide--chevron-left] size-full" />
    </Button>
    <div class="no-drag overflow-hidden">
      <div
        ref="scrollContent"
        class="workflow-tabs-scroll flex size-full scrollbar-thin scrollbar-thumb-alpha-smoke-500-50 scrollbar-track-transparent overflow-x-auto overflow-y-hidden p-0"
        @wheel="handleWheel"
      >
        <ToggleGroup
          :class="cn('workflow-tabs h-full gap-0 bg-transparent', props.class)"
          :model-value="selectedWorkflow?.value"
          type="single"
          @update:model-value="onWorkflowChange"
        >
          <ToggleGroupItem
            v-for="(option, index) in options"
            :key="option.value"
            :value="option.value"
            class="workflow-tab-button h-full flex-none rounded-none p-0"
          >
            <span class="workflow-tab-content">
              <WorkflowTab
                :workflow-option="option"
                :is-first="index === 0"
                :is-last="index === options.length - 1"
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
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
    <Button
      v-if="showOverflowArrows"
      variant="muted-textonly"
      size="icon"
      class="overflow-arrow overflow-arrow-right aspect-square h-full w-auto"
      :aria-label="$t('g.scrollRight')"
      :disabled="!rightArrowEnabled"
      @mousedown="whileMouseDown($event, () => scroll(1))"
    >
      <i class="icon-[lucide--chevron-right] size-full" />
    </Button>
    <WorkflowOverflowMenu
      v-if="showOverflowArrows"
      :workflows="workflowStore.openWorkflows"
      :active-workflow="workflowStore.activeWorkflow"
    />
    <Button
      v-tooltip="{
        value: $t('sideToolbar.newBlankWorkflow'),
        showDelay: 300
      }"
      class="new-blank-workflow-button no-drag aspect-square h-full w-auto shrink-0 rounded-none"
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('sideToolbar.newBlankWorkflow')"
      @click="() => commandStore.execute('Comfy.NewBlankWorkflow')"
    >
      <i class="pi pi-plus" />
    </Button>
    <div
      v-if="isIntegratedTabBar"
      data-testid="integrated-tab-bar-actions"
      :data-agent-gate-settled="agentPanelStore.gateSettled || undefined"
      class="ml-auto flex shrink-0 items-center gap-2 px-2"
    >
      <Button
        v-if="agentPanelStore.enabled"
        variant="link"
        size="sm"
        :aria-pressed="agentPanelStore.isOpen"
        :class="
          cn(
            'no-drag shrink-0 border border-solid text-base-foreground',
            agentPanelStore.isOpen
              ? 'border-plum-500 bg-plum-600/20'
              : 'border-plum-600 bg-ink-700 hover:border-plum-500'
          )
        "
        @click="onAgentEntryClick"
      >
        <i class="icon-[comfy--comfy-c] size-3 text-brand-yellow" />
        <span>{{ $t('agent.askComfyAgent') }}</span>
      </Button>
      <Button
        v-if="isCloud || isNightly"
        v-tooltip="{ value: $t('actionbar.feedbackTooltip'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon"
        class="shrink-0 text-base-foreground"
        :aria-label="$t('actionbar.feedback')"
        @click="openFeedback"
      >
        <i class="icon-[lucide--megaphone]" />
      </Button>
      <CurrentUserButton v-if="showCurrentUser" compact class="shrink-0 p-1" />
      <LoginButton v-else class="p-1" />
    </div>
    <div v-if="isDesktop" class="window-actions-spacer app-drag shrink-0" />
  </div>
</template>

<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch
} from 'vue'
import type { WatchStopHandle } from 'vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import WorkflowTab from '@/components/topbar/WorkflowTab.vue'
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowStatusDismissal } from '@/composables/useWorkflowStatusDismissal'
import { useOverflowObserver } from '@/composables/element/useOverflowObserver'
import { isCloud, isDesktop, isNightly } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { whileMouseDown } from '@/utils/mouseDownUtil'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import WorkflowOverflowMenu from './WorkflowOverflowMenu.vue'

interface WorkflowOption {
  value: string
  workflow: ComfyWorkflow
}

const props = defineProps<{
  class?: string
}>()

const settingStore = useSettingStore()
const workspaceStore = useWorkspaceStore()
const workflowStore = useWorkflowStore()
const workflowService = useWorkflowService()
const commandStore = useCommandStore()
const agentPanelStore = useAgentPanelStore()
const tabActivity = useWorkflowTabActivityStore()
const { isLoggedIn } = useCurrentUser()

function onAgentEntryClick(): void {
  useTelemetry()?.trackAgentEntryButtonClicked({
    resulting_state: agentPanelStore.isOpen ? 'closed' : 'opened'
  })
  agentPanelStore.toggle()
}

// Dismiss a tab's terminal status badge once it has been viewed
useWorkflowStatusDismissal()

const isIntegratedTabBar = computed(
  () => settingStore.get('Comfy.UI.TabBarLayout') !== 'Legacy'
)
const showCurrentUser = computed(() => isCloud || isLoggedIn.value)

function openFeedback() {
  openFeedbackDialog('topbar')
}

const containerRef = ref<HTMLElement | null>(null)
const showOverflowArrows = ref(false)
const leftArrowEnabled = ref(false)
const rightArrowEnabled = ref(false)

const workflowToOption = (workflow: ComfyWorkflow): WorkflowOption => ({
  value: workflow.path,
  workflow
})

const options = computed<WorkflowOption[]>(() =>
  workflowStore.openWorkflows.map(workflowToOption)
)
const selectedWorkflow = computed<WorkflowOption | null>(() =>
  workflowStore.activeWorkflow
    ? workflowToOption(workflowStore.activeWorkflow as ComfyWorkflow)
    : null
)

const onWorkflowChange = async (value: unknown) => {
  if (typeof value !== 'string') {
    return
  }
  const option = options.value.find((option) => option.value === value)
  // Prevent unselecting the current workflow
  if (!option) {
    return
  }
  // Prevent reloading the current workflow
  if (selectedWorkflow.value?.value === option.value) {
    return
  }

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

// Horizontal scroll on wheel
const handleWheel = (event: WheelEvent) => {
  const scrollElement = event.currentTarget as HTMLElement
  const scrollAmount = event.deltaX || event.deltaY
  scrollElement.scroll({
    left: scrollElement.scrollLeft + scrollAmount
  })
}

const scrollContent = ref<HTMLElement | null>(null)

const scroll = (direction: number) => {
  const el = scrollContent.value
  if (!el) return
  el.scrollBy({ left: direction * 20 })
}

const ensureActiveTabVisible = async (
  options: { waitForDom?: boolean } = {}
) => {
  if (!selectedWorkflow.value) return

  if (options.waitForDom !== false) {
    await nextTick()
  }

  const containerElement = containerRef.value
  if (!containerElement) return

  const activeTabElement = containerElement.querySelector(
    '.workflow-tab-button[data-state="on"]'
  )
  if (!activeTabElement) return

  activeTabElement.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

// Scroll to active offscreen tab when opened
watch(
  () => workflowStore.activeWorkflow,
  () => {
    void ensureActiveTabVisible()
  },
  { immediate: true }
)

watch(
  () => tabActivity.creatingTab,
  async (creating) => {
    if (!creating) return
    await nextTick()
    containerRef.value
      ?.querySelector('[data-testid="creating-tab-skeleton"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
)

let overflowObserver: ReturnType<typeof useOverflowObserver> | null = null
let stopArrivedWatch: WatchStopHandle | null = null
let stopOverflowWatch: WatchStopHandle | null = null

onMounted(() => {
  const el = scrollContent.value
  if (!el) return

  const scrollState = useScroll(el)

  stopArrivedWatch = watch(
    [() => scrollState.arrivedState.left, () => scrollState.arrivedState.right],
    ([atLeft, atRight]) => {
      leftArrowEnabled.value = !atLeft
      rightArrowEnabled.value = !atRight
    },
    { immediate: true }
  )

  overflowObserver = useOverflowObserver(el)
  stopOverflowWatch = watch(
    overflowObserver.isOverflowing,
    (isOverflow) => {
      showOverflowArrows.value = isOverflow
      if (!isOverflow) return
      void nextTick(() => {
        // Force a new check after arrows are updated
        scrollState.measure()
        void ensureActiveTabVisible({ waitForDom: false })
      })
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  stopArrivedWatch?.()
  stopOverflowWatch?.()
  overflowObserver?.dispose()
})

onUpdated(() => {
  if (!overflowObserver?.disposed.value) {
    overflowObserver?.checkOverflow()
  }
})
</script>

<style scoped>
.workflow-tabs-container {
  background-color: var(--comfy-menu-bg);
}

:deep(.workflow-tab-button) {
  position: relative;
  flex: 0 1 auto;
  border: 0;
  border-right-style: solid;
  border-right-width: 1px;
  border-radius: 0;
  background-color: transparent;
  padding: 0;
  border-right-color: var(--border-color);
  min-width: 90px;
  font-family: inherit;
  font-weight: 500;
  line-height: normal;
}

.overflow-arrow {
  border-radius: 0;
  padding-inline: calc(var(--spacing) * 2);
}

.overflow-arrow[disabled] {
  opacity: 0.25;
}

:deep(.workflow-tab) {
  max-width: 100%;
}

:deep(.workflow-tab-content) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--spacing) * 2);
}

:deep(.workflow-tab-button:first-child) {
  border-left-style: solid;
  border-left-width: 1px;
  border-left-color: var(--border-color);
}

:deep(.workflow-tab-button:not(:first-child)) {
  border-left-width: 0;
}

:deep(.workflow-tab-button[data-state='on']) {
  height: 100%;
  border-bottom-style: solid;
  border-bottom-width: 1px;
  border-bottom-color: var(--p-button-text-primary-color);
  background-color: transparent;
}

:deep(.workflow-tab-button[data-state='off']) {
  color: var(--p-text-muted-color);
  opacity: 0.75;
}

:deep(.workflow-tab-button[data-state='on']) .close-button,
:deep(.workflow-tab-button:hover) .close-button {
  visibility: visible;
}

:deep(.workflow-tabs) {
  display: flex;
}

.workflow-tabs-container-desktop {
  max-width: env(titlebar-area-width, 100vw);
}

.window-actions-spacer {
  flex: auto;
  /* If we are using custom titlebar, then we need to add a gap for the user to drag the window */
  --window-actions-spacer-width: min(75px, env(titlebar-area-width, 0) * 9999);
  min-width: var(--window-actions-spacer-width);
}
</style>
