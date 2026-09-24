<template>
  <div
    ref="containerRef"
    :class="
      cn(
        'workflow-tabs-container flex h-full flex-auto flex-row gap-1 overflow-hidden bg-comfy-menu-bg px-1',
        isDesktop ? 'max-w-[env(titlebar-area-width,100vw)]' : 'max-w-full'
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

import AgentEntryButton from '@/components/topbar/AgentEntryButton.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/components/topbar/TopbarSubscribeButton.vue'
import WorkflowTab from '@/components/topbar/WorkflowTab.vue'

import Button from '@/components/ui/button/Button.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
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
  if (!workflowStore.activeWorkflow) return

  if (options.waitForDom !== false) {
    await nextTick()
  }

  const containerElement = containerRef.value
  if (!containerElement) return

  const activeTabElement = containerElement.querySelector(
    '[role="tab"][aria-selected="true"]'
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
