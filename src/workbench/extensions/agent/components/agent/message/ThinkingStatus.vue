<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Plain "Thinking..." per the locked Figma decision (the monolith's rotating status
// words are dropped).
const { t } = useI18n()
</script>

<template>
  <div class="text-agent-fg-muted flex items-center gap-1.5 py-1 text-sm">
    <span class="icon-[lucide--brain] size-3.5 shrink-0" />
    <span class="agent-shimmer-text">{{ t('agent.thinking') }}</span>
  </div>
</template>
