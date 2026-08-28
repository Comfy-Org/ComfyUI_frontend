<template>
  <div
    data-testid="agent-panel-root"
    class="flex size-full flex-col bg-base-background text-base-foreground"
  >
    <div
      class="flex items-center justify-between border-b border-interface-stroke py-2 pr-2 pl-3"
    >
      <h2 id="agent-panel-title" class="text-sm font-medium">
        {{ t('agent.title') }}
      </h2>
      <Button
        variant="muted-textonly"
        size="icon"
        class="rounded-xl hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background"
        :aria-label="t('g.close')"
        @click="agentPanelStore.close()"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
    </div>
    <div class="flex-1" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agentPanelStore'

const { t } = useI18n()
const agentPanelStore = useAgentPanelStore()
</script>
