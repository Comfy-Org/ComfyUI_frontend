<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const dismissed = useStorage('Comfy.AgentPanel.runNoticeDismissed', false)
</script>

<template>
  <div
    v-if="!dismissed"
    role="note"
    class="border-agent-border bg-agent-surface border-l-agent-accent flex items-start gap-2 rounded-lg border border-l-4 p-4"
  >
    <span class="text-agent-accent icon-[lucide--info] size-5 shrink-0" />
    <p class="text-agent-fg my-0 min-w-0 flex-1 text-sm font-medium">
      {{ t('agent.runNotice') }}
    </p>
    <button
      type="button"
      :aria-label="t('agent.dismiss')"
      class="text-agent-fg-muted hover:text-agent-fg flex size-5 shrink-0 cursor-pointer items-center justify-center p-0"
      @click="dismissed = true"
    >
      <span class="icon-[lucide--x] size-4" />
    </button>
  </div>
</template>
