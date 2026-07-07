<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SuggestedPromptChip from './composer/SuggestedPromptChip.vue'

const { userName } = defineProps<{ userName?: string }>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t, tm } = useI18n()

const prompts = computed(() => tm('agent.suggestedPrompts') as string[])

// Leading icon per suggested prompt (Figma B5), in the same order as agent.suggestedPrompts.
const promptIcons = [
  'icon-[lucide--lightbulb]',
  'icon-[lucide--list]',
  'icon-[lucide--search]',
  'icon-[lucide--message-circle-question]',
  'icon-[lucide--workflow]'
]
</script>

<template>
  <div class="flex h-full flex-col p-4">
    <div
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center"
    >
      <div
        class="bg-agent-surface-raised flex size-14 items-center justify-center rounded-2xl"
      >
        <span
          class="icon-[comfy--comfy-c] size-8 text-brand-yellow drop-shadow-[0_0_12px_currentColor]"
          aria-hidden="true"
        />
      </div>
      <div class="space-y-0.5">
        <p class="text-agent-fg text-lg font-semibold">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
        </p>
        <p class="text-agent-fg text-lg font-semibold">
          {{ t('agent.greetingQuestion') }}
        </p>
      </div>
    </div>
    <div class="flex shrink-0 flex-col gap-1.5 pt-2">
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
