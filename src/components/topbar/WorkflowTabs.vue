<template>
  <div
    :class="
      cn(
        'workflow-tabs-container flex h-full flex-auto flex-row gap-1 overflow-hidden bg-comfy-menu-bg px-1',
        isDesktop ? 'max-w-[env(titlebar-area-width,100vw)]' : 'max-w-full'
      )
    "
  >
    <div
      ref="tabStripRef"
      data-testid="workflow-tab-strip"
      class="no-drag scrollbar-thin scrollbar-thumb-alpha-smoke-500-50 scrollbar-track-transparent overflow-x-auto overflow-y-hidden"
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
import { computed, nextTick, ref, watch } from 'vue'

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
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
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
    await withConsent('button_click', () => {
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

watch(
  () => workflowStore.activeWorkflow,
  () => void revealActiveTab(),
  { immediate: true }
)

const { isOverflowing, checkOverflow } = useOverflowObserver(tabStripRef, {
  onCheck: () => void revealActiveTab()
})

function handleTabResize(event: TransitionEvent) {
  if (event.propertyName !== 'flex-shrink') return
  checkOverflow()
}
</script>
