<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import { FALLBACK_LOCALE } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'

import type { AgentGreeting } from '../../types/proactiveGreeting'
import type { AgentStarterPromptAttribution } from '../../utils/starterPrompts'
import { starterPromptAttribution } from '../../utils/starterPrompts'
import GreetingHeading from './GreetingHeading.vue'
import ProactiveGreeting from './ProactiveGreeting.vue'

const { userName, greeting } = defineProps<{
  userName?: string
  greeting?: AgentGreeting
}>()
const emit = defineEmits<{
  insert: [
    text: string,
    prompt?: AgentStarterPromptAttribution,
    fadeInAfterMs?: number
  ]
}>()

const { t, te, tm, locale } = useI18n()

const promptKey = isCloud
  ? 'agent.suggestedPrompts.cloud'
  : 'agent.suggestedPrompts.local'
const prompts = computed(() => tm(promptKey) as string[])
const promptLocale = computed(() =>
  te(`${promptKey}.0`, locale.value) ? locale.value : FALLBACK_LOCALE
)

/**
 * One emit per click, carrying the slot's stable id rather than its text. Fires
 * on click only — not on render or focus — so the count is a count of choices.
 */
function onPromptClick(prompt: string, index: number): void {
  emit(
    'insert',
    prompt,
    starterPromptAttribution(
      prompt,
      index,
      prompts.value.length,
      promptLocale.value
    )
  )
}

const promptIcons = [
  'icon-[lucide--image]',
  'icon-[lucide--video]',
  'icon-[lucide--message-circle-question-mark]',
  isCloud ? 'icon-[lucide--scan-search]' : 'icon-[lucide--puzzle]',
  'icon-[lucide--message-circle-warning]'
]
</script>

<template>
  <ProactiveGreeting
    v-if="greeting"
    :greeting
    :user-name
    @insert="
      (text, fadeInAfterMs) => emit('insert', text, undefined, fadeInAfterMs)
    "
  />
  <div
    v-else
    class="flex h-full flex-col overflow-x-hidden overflow-y-auto px-4 py-8"
  >
    <div class="my-auto flex shrink-0 flex-col items-center gap-8 text-center">
      <GreetingHeading
        class="pt-12"
        :user-name
        :title="t('agent.greetingQuestion')"
      />
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
          @click="onPromptClick(prompt, index)"
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
