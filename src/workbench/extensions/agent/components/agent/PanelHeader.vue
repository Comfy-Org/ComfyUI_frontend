<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '../ui/Button.vue'

// Net-new vs the monolith (built to Figma B3): title + ALPHA badge, chat history, new
// chat, explicit close. Panel width comes from the host sidebar's native drag-resize.
const emit = defineEmits<{
  newChat: []
  close: []
  openHistory: []
}>()

const { t } = useI18n()
</script>

<template>
  <header
    class="border-agent-border flex items-center gap-2 border-b px-3 py-2"
  >
    <span class="text-agent-accent icon-[comfy--comfy-c] size-4" />
    <h1 class="text-sm font-semibold">{{ t('agent.title') }}</h1>
    <span
      class="bg-agent-accent/15 text-agent-accent rounded-full px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase"
    >
      {{ t('agent.alpha') }}
    </span>

    <div class="ml-auto flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('agent.history')"
        @click="emit('openHistory')"
      >
        <span class="icon-[lucide--history] size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <span class="icon-[lucide--square-pen] size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('agent.close')"
        @click="emit('close')"
      >
        <span class="icon-[lucide--x] size-4" />
      </Button>
    </div>
  </header>
</template>
