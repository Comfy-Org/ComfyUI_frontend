<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

const { userName } = defineProps<{ userName?: string }>()
const emit = defineEmits<{ insert: [text: string] }>()

const { t, tm } = useI18n()

const prompts = computed(() => tm('agent.suggestedPrompts') as string[])

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
    <div
      class="mx-auto flex w-full max-w-[640px] shrink-0 flex-wrap gap-2 @min-[460px]:justify-center"
    >
      <button
        v-for="(prompt, index) in prompts"
        :key="index"
        type="button"
        class="bg-agent-surface-raised text-agent-fg hover:bg-agent-surface-hover focus-visible:ring-agent-accent flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-full px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none @min-[460px]:w-auto"
        @click="emit('insert', prompt)"
      >
        <span
          :class="
            cn(
              'text-agent-fg-muted size-3 shrink-0',
              promptIcons[index] ?? 'icon-[lucide--sparkles]'
            )
          "
          aria-hidden="true"
        />
        <span class="truncate">{{ prompt }}</span>
      </button>
    </div>
  </div>
</template>
