<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'

const { userName, hasSelection = false } = defineProps<{
  userName?: string
  hasSelection?: boolean
}>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t, tm } = useI18n()

const promptIcons = [
  'icon-[lucide--lightbulb]',
  'icon-[lucide--list]',
  'icon-[lucide--search]',
  'icon-[lucide--message-circle-warning]',
  'icon-[lucide--workflow]'
]

const selectedNodePromptIndex = 3
const suggestions = computed(() =>
  (tm('agent.suggestedPrompts') as string[])
    .map((prompt, index) => ({
      prompt,
      icon: promptIcons[index] ?? 'icon-[lucide--sparkles]',
      requiresSelection: index === selectedNodePromptIndex
    }))
    .filter(({ requiresSelection }) => !requiresSelection || hasSelection)
)
</script>

<template>
  <div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8">
    <div class="my-auto flex shrink-0 flex-col items-center gap-8 text-center">
      <div
        class="flex max-w-sm flex-col items-center pt-12 text-base/snug font-semibold tracking-tight text-base-foreground @min-[570px]:text-2xl/snug"
      >
        <p class="my-0">
          {{ t('agent.greeting', { name: userName ?? t('agent.friend') }) }}
        </p>
        <p class="my-0">
          {{ t('agent.greetingQuestion') }}
        </p>
      </div>
      <div
        data-testid="suggested-prompts"
        class="mx-auto flex w-full max-w-[608px] shrink-0 flex-wrap gap-2 @min-[460px]:justify-center"
      >
        <Button
          v-for="suggestion in suggestions"
          :key="suggestion.prompt"
          type="button"
          variant="secondary"
          size="md"
          class="w-full max-w-full min-w-0 justify-start rounded-full px-3 text-sm @min-[460px]:w-auto"
          @click="emit('insert', suggestion.prompt)"
        >
          <span
            :class="
              cn('size-3 shrink-0 text-muted-foreground', suggestion.icon)
            "
            aria-hidden="true"
          />
          <span class="truncate">{{ suggestion.prompt }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>
