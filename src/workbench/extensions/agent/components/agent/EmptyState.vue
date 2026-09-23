<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

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
  <div class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8">
    <div class="my-auto flex shrink-0 flex-col items-center gap-8 text-center">
      <div class="flex flex-col items-center gap-4 pt-12">
        <div
          class="flex size-12 items-center justify-center rounded-xl border border-plum-600 bg-ink-700"
        >
          <span
            class="icon-[comfy--comfy-c] size-6 text-brand-yellow drop-shadow-[0_0_12px_currentColor]"
            aria-hidden="true"
          />
        </div>
        <div
          class="flex max-w-sm flex-col items-center text-base/snug font-semibold tracking-tight text-base-foreground @min-[570px]:text-2xl/snug"
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
        data-testid="suggested-prompts"
        class="mx-auto flex w-full max-w-[608px] shrink-0 flex-wrap gap-2 @min-[460px]:justify-center"
      >
        <Button
          v-for="(prompt, index) in prompts"
          :key="index"
          type="button"
          variant="secondary"
          size="md"
          class="w-full max-w-full min-w-0 justify-start rounded-full px-3 text-sm @min-[460px]:w-auto"
          @click="emit('insert', prompt)"
        >
          <span
            :class="
              cn(
                'size-3 shrink-0 text-muted-foreground',
                promptIcons[index] ?? 'icon-[lucide--sparkles]'
              )
            "
            aria-hidden="true"
          />
          <span class="truncate">{{ prompt }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>
