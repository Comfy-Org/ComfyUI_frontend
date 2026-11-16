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
          <DesktopAgentMarks />
          {{ $t('openOnCloud.deployWithAgent') }}
        </template>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
    <MenuItem
      v-if="localAgentEnabled"
      :disabled="isOpeningAgent"
      @select="useLocalAgent"
    >
      <i class="icon-[lucide--sparkles]" aria-hidden="true" />
      {{ $t('openOnCloud.agentMenu.useLocalAgent') }}
    </MenuItem>
    <MenuItem @select="openBriefIn('claude')">
      <AgentMark agent="claude" />
      {{ $t('openOnCloud.agentMenu.openInClaude') }}
    </MenuItem>
    <MenuItem @select="openBriefIn('codex')">
      <AgentMark agent="codex" />
      {{ $t('openOnCloud.agentMenu.openInCodex') }}
    </MenuItem>
    <MenuItem @select="copyWith(copyBrief)">
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
import { useLocalAgentPanelPort } from '@/platform/openOnCloud/localAgentPanelPort'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import { useRunOnCloudHandoff } from '@/platform/openOnCloud/useRunOnCloudHandoff'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'

const emit = defineEmits<{ done: [] }>()
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

function clearCopiedOnOpen(open: boolean) {
  if (open) copied.value = false
}
</script>
