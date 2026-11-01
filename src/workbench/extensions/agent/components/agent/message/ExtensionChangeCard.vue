<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ExtensionChangePart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'

const { part } = defineProps<{ part: ExtensionChangePart }>()

const { t } = useI18n()

const ACTIONS: Record<
  ExtensionChangePart['action'],
  { titleKey: string; icon: string }
> = {
  enabled: {
    titleKey: 'agent.extensionChange.enabled',
    icon: 'icon-[lucide--toggle-right]'
  },
  disabled: {
    titleKey: 'agent.extensionChange.disabled',
    icon: 'icon-[lucide--toggle-left]'
  },
  removed: {
    titleKey: 'agent.extensionChange.removed',
    icon: 'icon-[lucide--package-minus]'
  }
}

const title = computed(() =>
  t(ACTIONS[part.action].titleKey, { pack: part.pack })
)
</script>

<template>
  <div
    role="status"
    data-testid="agent-extension-change"
    class="flex items-start gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm"
  >
    <span
      aria-hidden="true"
      class="flex size-8 shrink-0 items-center justify-center rounded-md border bg-secondary text-muted-foreground"
    >
      <i aria-hidden="true" :class="ACTIONS[part.action].icon" />
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-sm/4 wrap-break-word text-foreground">{{ title }}</span>
      <span v-if="part.agentCreated" class="text-xs text-muted-foreground">
        {{ t('g.createdByAgent') }}
      </span>
      <span
        v-if="part.action === 'removed'"
        class="text-xs text-muted-foreground"
      >
        {{ t('agent.extensionChange.removedHint') }}
      </span>
      <span v-if="part.restartRequired" class="text-xs text-muted-foreground">
        {{ t('agent.extensionChange.restartHint') }}
      </span>
    </span>
  </div>
</template>
