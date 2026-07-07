<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Plain "Thinking..." per the locked Figma decision (the monolith's rotating status
// words are dropped). The running think-token count shows only when the server has sent
// one (tokens > 0).
const { tokens = 0 } = defineProps<{ tokens?: number }>()

const { t } = useI18n()
</script>

<template>
  <div class="text-agent-fg-muted flex items-center gap-2 py-1 text-sm">
    <span class="icon-[lucide--loader-circle] size-3.5 animate-spin" />
    <span>{{ t('agent.thinking') }}</span>
    <span v-if="tokens > 0" class="text-agent-fg-subtle text-xs">{{
      tokens
    }}</span>
  </div>
</template>
