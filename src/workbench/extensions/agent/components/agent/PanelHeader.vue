<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '../ui/Button.vue'

// Net-new vs the monolith (built to Figma B3): Comfy mark + title + neutral ALPHA badge,
// new chat, explicit close. History is reached from the session bar (B4), not the header.
const emit = defineEmits<{
  newChat: []
  close: []
}>()

const { t } = useI18n()
</script>

<template>
  <header
    class="border-agent-border flex items-center gap-2 border-b px-3 py-2"
  >
    <span class="icon-[comfy--comfy-c] size-4 text-brand-yellow" />
    <h1 class="text-sm font-semibold">{{ t('agent.title') }}</h1>
    <span
      class="border-agent-border text-agent-fg-subtle rounded-full border px-1.5 py-0.5 text-xs font-semibold tracking-wide uppercase"
    >
      {{ t('agent.alpha') }}
    </span>

    <div class="ml-auto flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('agent.newChat')"
        @click="emit('newChat')"
      >
        <span class="icon-[lucide--message-square] size-4" />
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
