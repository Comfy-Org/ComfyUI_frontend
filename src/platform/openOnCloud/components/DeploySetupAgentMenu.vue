<template>
  <AgentMenu
    variant="inverted"
    data-testid="deploy-setup-agent"
    :copy-brief="copyPrompt"
    @opened="track('run_on_cloud_agent_menu_opened')"
    @open-in="pickAgentApp"
  >
    <template #label>
      <DesktopAgentMarks />
      {{ $t('openOnCloud.deployWithAgent') }}
    </template>
    <template #items>
      <MenuItem
        v-if="
          pendingServerFact(
            'BE-26598',
            flags.openOnCloudUseLocalAgentEnabled && localAgentEnabled
          )
        "
        :disabled="isOpeningAgent"
        @select="pickLocalAgent"
      >
        <i class="icon-[lucide--sparkles]" aria-hidden="true" />
        {{ $t('openOnCloud.agentMenu.useLocalAgent') }}
      </MenuItem>
    </template>
  </AgentMenu>
</template>

<script setup lang="ts">
import { onScopeDispose } from 'vue'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import { useTelemetry } from '@comfyorg/telemetry'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useLocalAgentPanelPort } from '@/platform/openOnCloud/localAgentPanelPort'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import AgentMenu from '@/platform/workflow/deploy/components/AgentMenu.vue'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useRunOnCloudHandoff } from '@/platform/openOnCloud/useRunOnCloudHandoff'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'

const emit = defineEmits<{ done: [] }>()
const { flags } = useFeatureFlags()
const {
  enabled: localAgentEnabled,
  isOpening: isOpeningAgent,
  open: openLocalAgent
} = useLocalAgentPanelPort()

const { prepareBrief, copyBrief, openBriefIn } = useRunOnCloudHandoff()
let isActive = true
onScopeDispose(() => {
  isActive = false
})

async function useLocalAgent() {
  const prompt = await prepareBrief()
  if (prompt && (await openLocalAgent(prompt, () => isActive)) && isActive)
    emit('done')
}

function track(buttonId: string) {
  useTelemetry()?.trackUiButtonClicked({
    button_id: buttonId,
    element_group: 'run_on_cloud'
  })
}

function pickLocalAgent() {
  track('run_on_cloud_use_local_agent_clicked')
  void useLocalAgent()
}

const AGENT_APP_BUTTON_IDS: Record<AgentApp, string> = {
  claude: 'run_on_cloud_open_in_claude_clicked',
  codex: 'run_on_cloud_open_in_codex_clicked'
}

function pickAgentApp(app: AgentApp) {
  track(AGENT_APP_BUTTON_IDS[app])
  void openBriefIn(app)
}

function copyPrompt() {
  track('run_on_cloud_copy_prompt_clicked')
  return copyBrief()
}
</script>
