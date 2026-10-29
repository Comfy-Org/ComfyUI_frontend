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
          <LocalAgentMarks />
          {{ $t('deployToComfyApi.deployWithAgent') }}
        </template>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
    <MenuItem @select="startLocalAgent">
      <i class="icon-[lucide--astroid]" aria-hidden="true" />
      {{ $t('openOnCloud.agentMenu.useLocalAgent') }}
    </MenuItem>
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
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import { useToast } from '@/components/ui/toast/toastStore'
import LocalAgentMarks from '@/platform/openOnCloud/components/LocalAgentMarks.vue'
import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'

const emit = defineEmits<{
  started: []
}>()

const { t } = useI18n()
const toast = useToast()
const localAgent = useLocalAgentStore()
const { copyBrief } = useAgentHandoff()
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

async function copyAndSay(title: string, description: string) {
  if (await copyHandoff()) toast.info(title, { description, duration: 6000 })
}

function startLocalAgent() {
  if (!localAgent.isFound) {
    void copyAndSay(
      t('openOnCloud.agentMenu.agentNotFound'),
      t('openOnCloud.agentMenu.agentNotFoundDetail')
    )
    return
  }
  localAgent.convert()
  emit('started')
}

function openInDesktop(app: 'claude' | 'chatGpt') {
  void copyAndSay(
    t('openOnCloud.agentMenu.promptCopied'),
    app === 'claude'
      ? t('openOnCloud.agentMenu.claudeHandoff')
      : t('openOnCloud.agentMenu.chatGptHandoff')
  )
}
</script>
