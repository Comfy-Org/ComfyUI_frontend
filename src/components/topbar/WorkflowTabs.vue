<template>
  <div
    ref="containerRef"
    :class="
      cn(
        'workflow-tabs-container flex h-full max-w-full flex-auto flex-row gap-1 overflow-hidden px-1',
        isDesktop && 'workflow-tabs-container-desktop'
      )
    "
  >
    <Button
      v-if="showOverflowArrows"
      variant="muted-textonly"
      size="icon"
      class="shrink-0 self-center rounded-lg p-2 disabled:opacity-25"
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
        <SelectButton
          :class="
            cn(
              'workflow-tabs flex items-center gap-1 bg-transparent',
              props.class
            )
          "
          :pt="{
            pcToggleButton: {
              root: ({ context }: ToggleButtonPassThroughMethodOptions) =>
                cn(tabStateVariants({ active: context.active }), 'p-0')
            }
          }"
          :model-value="selectedWorkflow"
          :options
          option-label="label"
          data-key="value"
          :allow-empty="false"
          @click="onWorkflowClick"
        >
          <template #option="{ option, index }">
            <WorkflowTab
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
          </template>
        </SelectButton>
      </div>
    </div>
    <Button
      v-if="showOverflowArrows"
      variant="muted-textonly"
      size="icon"
      class="shrink-0 self-center rounded-lg p-2 disabled:opacity-25"
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
      class="new-blank-workflow-button no-drag shrink-0 self-center rounded-lg"
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
      :data-agent-flags-settled="agentPanelStore.flagsSettled || undefined"
      class="ml-auto flex shrink-0 items-center gap-2 px-2"
    >
      <TopbarBadges />
      <TopbarSubscribeButton />
      <div
        v-if="topbarBadgeStore.badges.length"
        data-testid="environment-badge-separator"
        class="h-5 w-px shrink-0 bg-border-subtle"
      />
      <Button
        v-if="isCloud || isNightly"
        v-tooltip="{ value: $t('actionbar.feedbackTooltip'), showDelay: 300 }"
        variant="muted-textonly"
        size="icon"
        class="size-6 shrink-0 rounded-sm p-0"
        :aria-label="$t('actionbar.feedback')"
        @click="openFeedback"
      >
        <i class="icon-[lucide--megaphone] size-4" />
      </Button>
      <CurrentUserButton v-if="showCurrentUser" compact class="shrink-0 p-1" />
      <LoginButton v-else class="p-1" />
      <template v-if="showAgentEntry">
        <div
          data-testid="agent-entry-separator"
          class="h-5 w-px shrink-0 bg-border-subtle"
        />
        <AgentEntryButton
          :active="agentPanelStore.isVisible"
          :inviting="!agentPanelStore.hasEverOpened"
          @click="onAgentEntryClick"
        />
      </template>
    </div>
    <div v-else class="ml-auto flex h-full shrink-0 items-center">
      <TopbarBadges />
      <TopbarSubscribeButton />
    </div>
    <div v-if="isDesktop" class="window-actions-spacer app-drag shrink-0" />
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useScroll, whenever } from '@vueuse/core'
import SelectButton from 'primevue/selectbutton'
import type { ToggleButtonPassThroughMethodOptions } from 'primevue/togglebutton'
import { computed, nextTick, onUpdated, ref, watch } from 'vue'

import AgentEntryButton from '@/components/topbar/AgentEntryButton.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTab from '@/components/topbar/WorkflowTab.vue'

import { tabStateVariants } from '@/components/tab/tab.variants'
import Button from '@/components/ui/button/Button.vue'
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
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'
import { useWorkflowTabActivityStore } from '@/stores/workflowTabActivityStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
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
const topbarBadgeStore = useTopbarBadgeStore()
const { withConsent, isChecking } = useAgentConsent()
const tabActivity = useWorkflowTabActivityStore()
const isOpeningAgent = ref(false)
const { isLoggedIn } = useCurrentUser()

const showAgentEntry = computed(
  () => agentPanelStore.enabled && !(agentPanelStore.isOpen && isChecking.value)
)

async function onAgentEntryClick(): Promise<void> {
  if (isOpeningAgent.value) return
  isOpeningAgent.value = true

  try {
    if (agentPanelStore.isVisible) {
      useTelemetry()?.trackAgentEntryButtonClicked({
        resulting_state: 'closed'
      })
      agentPanelStore.toggle()
      return
    }

    agentPanelStore.suppressRestoredOpen()
    await withConsent(() => {
      if (!agentPanelStore.enabled) return
      useTelemetry()?.trackAgentEntryButtonClicked({
        resulting_state: 'opened'
      })
      agentPanelStore.open()
    })
  } finally {
    isOpeningAgent.value = false
  }
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
    '.p-togglebutton-checked'
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

<style scoped>
.workflow-tabs-container {
  background-color: var(--comfy-menu-bg);
}

:deep(.p-togglebutton) {
  position: relative;
  flex-shrink: 1;
  border: 0;
  padding: 0;
  min-width: 90px;
}

:deep(.p-togglebutton > .p-togglebutton-content) {
  max-width: 100%;
}

:deep(.workflow-tab) {
  max-width: 100%;
}

:deep(.p-togglebutton::before) {
  display: none;
}

:deep(.p-selectbutton) {
  height: 100%;
  border-radius: 0;
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
