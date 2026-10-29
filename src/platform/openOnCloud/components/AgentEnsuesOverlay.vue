<template>
  <Teleport to="body">
    <div
      v-if="localAgent.isConverting"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('openOnCloud.agentMenu.agentEnsues')"
      class="fixed inset-0 z-overlay grid place-items-center bg-black/70"
      data-testid="agent-ensues"
      @click="localAgent.stop()"
    >
      <span class="text-5xl font-semibold tracking-tight text-white">
        {{ $t('openOnCloud.agentMenu.agentEnsues') }}
      </span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'

const localAgent = useLocalAgentStore()

onKeyStroke('Escape', () => {
  if (localAgent.isConverting) localAgent.stop()
})
</script>
