<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SuggestedPromptChip from './composer/SuggestedPromptChip.vue'

// NOTE(figma): the five prompt strings are placeholders pending the exact Figma copy
// (board 2141-8837); wording is a one-line locale change once confirmed.
const { userName } = defineProps<{ userName?: string }>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t, tm } = useI18n()

const prompts = computed(() => tm('agent.suggestedPrompts') as string[])
</script>

<template>
  <div class="flex h-full flex-col justify-end gap-6 px-4 py-6">
    <div class="space-y-1">
      <p class="text-agent-fg text-lg font-medium">
        {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
      </p>
      <p class="text-agent-fg-muted text-lg">
        {{ t('agent.greetingQuestion') }}
      </p>
    </div>
    <div class="flex flex-col gap-2">
      <SuggestedPromptChip
        v-for="(prompt, index) in prompts"
        :key="index"
        :text="prompt"
        @insert="emit('insert', $event)"
      />
    </div>
  </div>
</template>
