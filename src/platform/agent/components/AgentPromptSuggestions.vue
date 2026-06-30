<script setup lang="ts">
import Suggestion from '@/components/ai-elements/suggestion/Suggestion.vue'
import Suggestions from '@/components/ai-elements/suggestion/Suggestions.vue'

const emit = defineEmits<{
  select: [suggestion: string]
}>()

const suggestions = [
  { key: 'duck', icon: 'icon-[lucide--lightbulb]' },
  { key: 'savedWorkflows', icon: 'icon-[lucide--list]' },
  { key: 'skinUpscaling', icon: 'icon-[lucide--search]' },
  { key: 'explainNode', icon: 'icon-[lucide--message-circle-warning]' },
  { key: 'imageToVideo', icon: 'icon-[lucide--workflow]' }
] as const
</script>

<template>
  <Suggestions>
    <Suggestion
      v-for="item in suggestions"
      :key="item.key"
      :suggestion="$t(`agent.suggestions.${item.key}`)"
      @select="emit('select', $event)"
    >
      <i :class="item.icon" class="size-3.5" />
      <span>{{ $t(`agent.suggestions.${item.key}`) }}</span>
    </Suggestion>
  </Suggestions>
</template>
