<template>
  <div
    ref="containerRef"
    :class="
      cn(
        'workflow-tabs-container flex h-full flex-auto flex-row overflow-hidden bg-comfy-menu-bg',
        isDesktop ? 'max-w-[env(titlebar-area-width,100vw)]' : 'max-w-full'
      )
    "
  >
    <Button
      v-if="showOverflowArrows"
      variant="muted-textonly"
      size="icon"
      class="overflow-arrow-left aspect-square h-full w-auto rounded-none px-2 disabled:opacity-25"
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
          :class="
            cn('workflow-tabs flex h-full gap-0 bg-transparent', props.class)
          "
          :model-value="selectedWorkflow?.value"
          type="single"
          @click="onWorkflowClick"
        >
          <ToggleGroupItem
            v-for="(option, index) in options"
            :key="option.value"
            :value="option.value"
            class="workflow-tab-button group/tab relative h-full min-w-[90px] flex-[0_1_auto] rounded-none border-0 border-r border-solid border-interface-stroke bg-transparent p-0 font-[inherit] leading-[normal] font-medium first:border-l hover:bg-transparent data-[state=off]:text-text-muted data-[state=off]:opacity-75 data-[state=on]:border-b data-[state=on]:border-b-text-primary data-[state=on]:bg-transparent"
          >
            <span
              class="relative inline-flex max-w-full items-center justify-center gap-2 group-data-[state=off]/tab:-top-px"
            >
              <WorkflowTab
                class="max-w-full"
                :workflow-option="option"
                :is-first="index === 0"
                :is-last="index === options.length - 1"
                :data-workflow-path="option.value"
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
      class="overflow-arrow-right aspect-square h-full w-auto rounded-none px-2 disabled:opacity-25"
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
        v-if="agentPanelStore.enabled && !agentPanelStore.isOpen"
        variant="link"
        size="sm"
        class="no-drag shrink-0 border border-solid border-plum-600 bg-ink-700 text-base-foreground hover:border-plum-500"
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
    <div
      v-if="isDesktop"
      class="window-actions-spacer app-drag min-w-[min(75px,env(titlebar-area-width,0)*9999)] flex-auto shrink-0"
    />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useScroll, whenever } from '@vueuse/core'
import { computed, nextTick, onUpdated, ref, watch } from 'vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import WorkflowTab from '@/components/topbar/WorkflowTab.vue'

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
  revision: number
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
const selectionRevision = ref(0)

const workflowToOption = (
  workflow: ComfyWorkflow,
  revision = 0
): WorkflowOption => ({
  value: workflow.path,
  workflow,
  revision
})

const options = computed<WorkflowOption[]>(() =>
  workflowStore.openWorkflows.map(workflowToOption)
)
const selectedWorkflow = computed<WorkflowOption | null>(() =>
  workflowStore.activeWorkflow
    ? workflowToOption(
        workflowStore.activeWorkflow as ComfyWorkflow,
        selectionRevision.value
      )
    : null
)

const onWorkflowClick = async (event: MouseEvent) => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return

  const workflowElement =
    target.closest<HTMLElement>('[data-workflow-path]') ??
    target
      .closest<HTMLButtonElement>('button')
      ?.querySelector<HTMLElement>('[data-workflow-path]')
  const path = workflowElement?.dataset.workflowPath
  const option = options.value.find(({ value }) => value === path)
  if (!option) return

  try {
    const opened = await workflowService.openWorkflow(option.workflow)
    if (opened === false) {
      selectionRevision.value++
      await nextTick()
    }
  } catch (error) {
    selectionRevision.value++
    await nextTick()
    throw error
  }
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

const scrollState = useScroll(scrollContent)
const leftArrowEnabled = computed(() => !scrollState.arrivedState.left)
const rightArrowEnabled = computed(() => !scrollState.arrivedState.right)
const { isOverflowing: showOverflowArrows, checkOverflow } =
  useOverflowObserver(scrollContent)

whenever(showOverflowArrows, () => {
  void nextTick(() => {
    scrollState.measure()
    void ensureActiveTabVisible({ waitForDom: false })
  })
})

onUpdated(checkOverflow)
</script>
