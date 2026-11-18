<template>
  <Menu
    align="end"
    :side-offset="6"
    :class="cn('min-w-52', switcherMenuMotionClass)"
    @update:open="onMenuOpenChange"
  >
    <template #trigger>
      <Button
        variant="inverted"
        size="lg"
        :class="cn('w-full @xl:w-auto', !copied && 'gap-3')"
        data-testid="deploy-setup-agent"
        :loading="isCopying"
      >
        <template v-if="copied">
          <i class="icon-[lucide--check]" aria-hidden="true" />
          {{ $t('deployToComfyApi.copied') }}
        </template>
        <template v-else>
          <DesktopAgentMarks />
          {{ $t('openOnCloud.deployWithAgent') }}
        </template>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
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
    <MenuItem @select="pickAgentApp('claude')">
      <AgentMark agent="claude" />
      {{ $t('openOnCloud.agentMenu.openInClaude') }}
    </MenuItem>
    <MenuItem @select="pickAgentApp('codex')">
      <AgentMark agent="codex" />
      {{ $t('openOnCloud.agentMenu.openInCodex') }}
    </MenuItem>
    <MenuItem @select="pickCopyPrompt">
      <i class="icon-[lucide--copy]" aria-hidden="true" />
      {{ $t('openOnCloud.agentMenu.copyPrompt') }}
    </MenuItem>
  </Menu>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { onScopeDispose } from 'vue'
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import { useTelemetry } from '@comfyorg/telemetry'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useLocalAgentPanelPort } from '@/platform/openOnCloud/localAgentPanelPort'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import { pendingServerFact } from '@/platform/serverFacts/pendingServerFact'
import { useRunOnCloudHandoff } from '@/platform/openOnCloud/useRunOnCloudHandoff'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'

const emit = defineEmits<{ done: [] }>()
const { flags } = useFeatureFlags()
const {
  enabled: localAgentEnabled,
  isOpening: isOpeningAgent,
  open: openLocalAgent
} = useLocalAgentPanelPort()

const { prepareBrief, copyBrief, openBriefIn } = useRunOnCloudHandoff()
const { isCopying, copied, copyWith } = useBriefCopy()
let isActive = true
onScopeDispose(() => {
  isActive = false
})

async function useLocalAgent() {
  const prompt = prepareBrief()
  if (prompt && (await openLocalAgent(prompt, () => isActive)) && isActive)
    emit('done')
}

function track(buttonId: string) {
  useTelemetry()?.trackUiButtonClicked({
    button_id: buttonId,
    element_group: 'run_on_cloud'
  })
}

function onMenuOpenChange(open: boolean) {
  if (!open) return
  copied.value = false
  track('run_on_cloud_agent_menu_opened')
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
  openBriefIn(app)
}

function pickCopyPrompt() {
  track('run_on_cloud_copy_prompt_clicked')
  return copyWith(copyBrief)
}
</script>
