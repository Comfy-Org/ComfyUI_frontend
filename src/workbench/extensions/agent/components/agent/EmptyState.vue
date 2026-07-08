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
  'icon-[lucide--message-circle-warning]',
  'icon-[lucide--workflow]'
]
</script>

<template>
  <div class="flex h-full flex-col p-4">
    <div
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div
        class="mb-2 flex size-12 items-center justify-center rounded-xl border border-plum-600 bg-ink-700"
      >
        <span
          class="icon-[comfy--comfy-c] size-6 text-brand-yellow drop-shadow-[0_0_12px_currentColor]"
          aria-hidden="true"
        />
      </div>
      <div
        class="text-agent-fg flex max-w-sm flex-col items-center gap-2 text-base/snug font-semibold tracking-tight @min-[570px]:text-2xl/snug"
      >
        <p class="my-0">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
        </p>
        <p class="my-0">
          {{ t('agent.greetingQuestion') }}
        </p>
      </div>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2 @min-[460px]:justify-center">
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
