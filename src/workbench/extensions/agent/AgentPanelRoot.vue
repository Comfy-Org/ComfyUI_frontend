<template>
  <div
    data-testid="agent-panel-root"
    class="bg-agent-surface text-agent-fg flex size-full flex-col"
  >
    <div
      class="border-agent-border flex items-center justify-between border-b py-2 pr-2 pl-3"
    >
      <span class="text-sm font-medium">{{ t('agent.title') }}</span>
      <Button
        variant="muted-textonly"
        size="icon"
        class="hover:text-agent-fg focus-visible:ring-agent-accent rounded-xl focus-visible:ring-2"
        :aria-label="t('g.close')"
        @click="agentPanelStore.close()"
      >
        <span class="icon-[lucide--x] size-4" />
      </Button>
    </div>
    <div class="flex-1" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

const { t } = useI18n()
const agentPanelStore = useAgentPanelStore()
</script>
