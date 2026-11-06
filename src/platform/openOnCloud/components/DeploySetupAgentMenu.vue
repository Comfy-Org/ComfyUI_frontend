<template>
  <Menu
    align="end"
    :side-offset="6"
    :class="cn('min-w-52', switcherMenuMotionClass)"
    @update:open="clearCopiedOnOpen"
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
          <img
            v-if="localAgentAvailable"
            :src="localAgentMarks"
            alt=""
            class="h-7 w-[45px] object-contain"
          />
          <DesktopAgentMarks v-else />
          {{ $t('deployToComfyApi.deployWithAgent') }}
        </template>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
    <MenuItem v-if="localAgentAvailable" @select="openInLocalAgent">
      <img :src="localAgentIcon" alt="" class="size-4" />
      {{ $t('openOnCloud.agentMenu.useLocalAgent') }}
    </MenuItem>
    <MenuItem @select="openBriefIn('claude')">
      <AgentMark agent="claude" />
      {{ $t('openOnCloud.agentMenu.openInClaude') }}
    </MenuItem>
    <MenuItem @select="openBriefIn('chatGpt')">
      <AgentMark agent="codex" />
      {{ $t('openOnCloud.agentMenu.openInChatGpt') }}
    </MenuItem>
    <MenuItem @select="copyHandoff">
      <i class="icon-[lucide--copy]" aria-hidden="true" />
      {{ $t('openOnCloud.agentMenu.copyPrompt') }}
    </MenuItem>
  </Menu>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import localAgentIcon from '@/assets/images/openOnCloud/local-agent.svg'
import localAgentMarks from '@/assets/images/openOnCloud/local-agent-marks.svg'
import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { LOCAL_DEPLOYMENT_AGENT_COMMAND } from '@/platform/openOnCloud/localDeploymentAgentCommand'
import { useErrorHandling } from '@/composables/useErrorHandling'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'

const { copyBrief, buildBrief, openBriefIn } = useAgentHandoff()
const { flags } = useFeatureFlags()
const commands = useCommandStore()
const localAgentAvailable = computed(() => flags.agent?.state === 'ready')
const { toastErrorHandler } = useErrorHandling()
const isCopying = ref(false)
const copied = ref(false)

function clearCopiedOnOpen(open: boolean) {
  if (open) copied.value = false
}

function openInLocalAgent() {
  void commands
    .execute(LOCAL_DEPLOYMENT_AGENT_COMMAND, {
      metadata: { brief: buildBrief('local-deployment') }
    })
    .catch(toastErrorHandler)
}

async function copyHandoff() {
  if (isCopying.value) return
  isCopying.value = true
  copied.value = false
  try {
    copied.value = await copyBrief()
  } finally {
    isCopying.value = false
  }
}
</script>
