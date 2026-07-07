<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SuggestedPromptChip from './composer/SuggestedPromptChip.vue'

const { userName } = defineProps<{ userName?: string }>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t, tm } = useI18n()

const prompts = computed(() => tm('agent.suggestedPrompts') as string[])
</script>

<template>
  <div class="flex h-full flex-col justify-end gap-6 px-4 py-6">
    <div class="flex flex-col items-center gap-3 text-center">
      <span
        class="text-agent-accent icon-[comfy--comfy-c] size-12 drop-shadow-[0_0_12px_currentColor]"
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
        @insert="emit('insert', $event)"
      />
    </div>
  </div>
</template>
