<template>
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
      class="h-5 w-px shrink-0 bg-border/50"
    />
    <Button
      v-if="isCloud || isNightly"
      :tooltip="$t('actionbar.feedbackTooltip')"
      variant="muted-textonly"
      size="icon"
      class="size-6 shrink-0 rounded-sm p-0"
      :aria-label="$t('actionbar.feedback')"
      @click="openFeedback"
    >
      <i class="icon-[lucide--megaphone]" />
    </Button>
    <CurrentUserButton v-if="showCurrentUser" compact class="shrink-0 p-1" />
    <LoginButton v-else class="p-1" />
    <template v-if="showAgentEntry">
      <div
        data-testid="agent-entry-separator"
        class="h-5 w-px shrink-0 bg-border/50"
      />
      <AgentEntryButton
        :active="agentPanelStore.isVisible"
        :inviting="!agentPanelStore.hasEverOpened"
        :comfy-agent="comfyAgentNotReady"
        @click="onAgentEntryClick"
      />
    </template>
  </div>
  <div v-else class="ml-auto flex h-full shrink-0 items-center">
    <TopbarBadges />
    <TopbarSubscribeButton />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import AgentEntryButton from '@/components/topbar/AgentEntryButton.vue'
import CurrentUserButton from '@/components/topbar/CurrentUserButton.vue'
import LoginButton from '@/components/topbar/LoginButton.vue'
import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import TopbarSubscribeButton from '@/platform/billing/components/TopbarSubscribeButton.vue'
import Button from '@comfyorg/design-system/button/Button'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud, isNightly } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'
import { useTelemetry } from '@/platform/telemetry'
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'
import { useAgentConsent } from '@/workbench/extensions/agent/composables/agent/useAgentConsent'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const settingStore = useSettingStore()
const agentPanelStore = useAgentPanelStore()
const topbarBadgeStore = useTopbarBadgeStore()
const { withConsent, isChecking } = useAgentConsent()
const isOpeningAgent = ref(false)
const { isLoggedIn } = useCurrentUser()

const isIntegratedTabBar = computed(
  () => settingStore.get('Comfy.UI.TabBarLayout') !== 'Legacy'
)
const showCurrentUser = computed(() => isCloud || isLoggedIn.value)
const comfyAgentNotReady = computed(() =>
  agentPanelStore.enabled || agentPanelStore.comfyAgent?.state === 'ready'
    ? undefined
    : agentPanelStore.comfyAgent
)
const showAgentEntry = computed(
  () =>
    (agentPanelStore.enabled || comfyAgentNotReady.value !== undefined) &&
    !(agentPanelStore.isOpen && isChecking.value)
)

function openFeedback() {
  openFeedbackDialog('topbar')
}

async function onAgentEntryClick(): Promise<void> {
  if (isOpeningAgent.value || comfyAgentNotReady.value) return
  isOpeningAgent.value = true

  try {
    if (
      agentPanelStore.onboarding.agentButton === 'togglePanel' ||
      agentPanelStore.isVisible
    ) {
      useTelemetry()?.trackAgentEntryButtonClicked({
        resulting_state: agentPanelStore.isVisible ? 'closed' : 'opened'
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
</script>
