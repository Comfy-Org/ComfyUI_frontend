<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SuggestedPromptChip from './composer/SuggestedPromptChip.vue'

const { userName } = defineProps<{ userName?: string }>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t, tm } = useI18n()

const prompts = computed(() => tm('agent.suggestedPrompts') as string[])

// Leading icon per suggested prompt (Figma B5). Best-fit lucide icons pending the exact
// Figma icon set for the frame.
const promptIcons = [
  'icon-[lucide--sparkles]',
  'icon-[lucide--folder-open]',
  'icon-[lucide--search]',
  'icon-[lucide--circle-help]',
  'icon-[lucide--clapperboard]'
]
</script>

<template>
  <div class="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
    <div class="mt-auto flex flex-col items-center gap-3 text-center">
      <span
        class="icon-[comfy--comfy-c] size-12 text-brand-yellow drop-shadow-[0_0_12px_currentColor]"
        aria-hidden="true"
      />
      <div class="space-y-1">
        <p class="text-agent-fg text-lg font-medium">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
        </p>
        <p class="text-agent-fg-muted text-lg">
          {{ t('agent.greetingQuestion') }}
        </p>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <SuggestedPromptChip
        v-for="(prompt, index) in prompts"
        :key="index"
        :text="prompt"
        :icon="promptIcons[index] ?? 'icon-[lucide--sparkles]'"
        @insert="emit('insert', $event)"
      />
    </div>
  </div>
</template>
