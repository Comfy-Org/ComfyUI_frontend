<template>
  <Menu
    align="end"
    :side-offset="6"
    class="min-w-57.5"
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
          <AgentMarks
            :marks="isLocalAgentReady ? 'localAgent' : 'desktopAgents'"
          />
          {{ $t('deployToComfyApi.deployWithAgent') }}
        </template>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
    <MenuItem v-if="isLocalAgentReady">
      <i class="icon-[lucide--astroid]" aria-hidden="true" />
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

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import AgentMarks from '@/platform/workflow/deploy/components/AgentMarks.vue'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'

const { flags } = useFeatureFlags()
const { copyBrief, openBriefIn } = useAgentHandoff()
const isCopying = ref(false)
const copied = ref(false)
const isLocalAgentReady = computed(() => flags.agent?.state === 'ready')

function clearCopiedOnOpen(open: boolean) {
  if (open) copied.value = false
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
