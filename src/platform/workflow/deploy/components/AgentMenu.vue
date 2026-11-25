<template>
  <Menu
    align="end"
    :side-offset="6"
    :class="cn('min-w-52', switcherMenuMotionClass)"
    @update:open="onMenuOpenChange"
  >
    <template #trigger>
      <Button
        v-bind="$attrs"
        :variant
        size="lg"
        :class="cn('w-full @xl:w-auto', !copied && 'gap-3')"
        :loading="isCopying"
      >
        <template v-if="copied">
          <i class="icon-[lucide--check]" aria-hidden="true" />
          {{ $t('deployToComfyApi.copied') }}
        </template>
        <slot v-else name="label" />
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </template>
    <slot name="items" />
    <MenuItem @select="emit('openIn', 'claude')">
      <AgentMark agent="claude" />
      {{ $t('openOnCloud.agentMenu.openInClaude') }}
    </MenuItem>
    <MenuItem @select="emit('openIn', 'codex')">
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
import Button from '@comfyorg/design-system/button/Button'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { switcherMenuMotionClass } from '@/platform/workspace/components/deploymentSwitcherStyles'
import { useBriefCopy } from '@/platform/workspace/composables/useBriefCopy'

const { variant, copyBrief } = defineProps<{
  variant: ButtonVariants['variant']
  copyBrief: () => Promise<boolean>
}>()

const emit = defineEmits<{
  opened: []
  openIn: [app: AgentApp]
}>()

defineOptions({ inheritAttrs: false })

const { isCopying, copied, copyWith } = useBriefCopy()

function onMenuOpenChange(open: boolean) {
  if (!open) return
  copied.value = false
  emit('opened')
}
</script>
