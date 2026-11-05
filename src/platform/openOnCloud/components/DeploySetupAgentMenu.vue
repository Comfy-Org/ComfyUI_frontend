<template>
  <Menu
    align="end"
    :side-offset="6"
    :class="cn('min-w-52', switcherMenuMotionClass)"
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
          {{ $t('deployToComfyApi.deployWithAgent') }}
        </template>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
    <MenuItem @select="openInDesktop('claude')">
      <AgentMark agent="claude" />
      {{ $t('openOnCloud.agentMenu.openInClaude') }}
    </MenuItem>
    <MenuItem @select="openInDesktop('chatGpt')">
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
import { ref } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'

const { copyBrief, buildBrief } = useAgentHandoff()
const isCopying = ref(false)
const copied = ref(false)

async function copyHandoff(): Promise<boolean> {
  if (isCopying.value) return false
  isCopying.value = true
  copied.value = false
  try {
    copied.value = await copyBrief()
    return copied.value
  } finally {
    isCopying.value = false
  }
}

function openInDesktop(app: 'claude' | 'chatGpt') {
  const prompt = encodeURIComponent(buildBrief())
  const url =
    app === 'claude'
      ? `claude://code/new?q=${prompt}`
      : `codex://new?prompt=${prompt}`
  window.location.assign(url)
}
</script>
