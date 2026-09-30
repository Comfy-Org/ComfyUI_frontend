<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)
const visibility = useDocumentVisibility()
// A single scripted exchange: M asks a question, B replies with a deployed
// workflow link and a code snippet, and M says thanks. It loops in place
// rather than cycling between different exchanges, since there's only one.
const chatScript = [
  {
    reply: false,
    avatar: 'M',
    text: 'platform.howItWorks.chat.message'
  },
  {
    reply: true,
    avatar: 'B',
    text: 'platform.howItWorks.chat.reply',
    endpoint: 'video-upscale-4k',
    snippet: 'platform.howItWorks.chat.replySnippet'
  },
  {
    reply: false,
    avatar: 'M',
    text: 'platform.howItWorks.chat.thanks'
  }
] as const
type ChatMessage = {
  id: number
  reply: boolean
  avatar: string
  text: (typeof chatScript)[number]['text']
  endpoint?: string
  snippet?: 'platform.howItWorks.chat.replySnippet'
}
const initialMessages: ChatMessage[] = chatScript.map((message, index) => ({
  ...message,
  id: index
}))
const tick = ref(chatScript.length - 1)
const messages = ref<ChatMessage[]>(initialMessages)
const reduced = computed(() => prefersReducedMotion())
const displayed = computed(() =>
  reduced.value ? initialMessages : messages.value
)
const { pause, resume } = useIntervalFn(
  () => {
    tick.value += 1
    const next = chatScript[tick.value % chatScript.length]
    messages.value = [
      ...messages.value.slice(-(chatScript.length - 1)),
      { ...next, id: tick.value }
    ]
  },
  1600,
  { immediate: false }
)
watchEffect(() => {
  if (visible.value && visibility.value === 'visible' && !reduced.value)
    resume()
  else pause()
})
</script>

<template>
  <div
    ref="root"
    class="relative h-full w-full min-w-0 overflow-hidden bg-primary-comfy-ink text-primary-warm-white"
  >
    <div
      class="absolute inset-0 overflow-hidden"
      :style="{
        maskImage: 'linear-gradient(to bottom, transparent, black 25%, black)'
      }"
    >
      <TransitionGroup
        tag="div"
        class="absolute inset-x-2 bottom-2 flex flex-col justify-end gap-3"
        move-class="transition-transform duration-500 motion-reduce:transition-none"
        enter-active-class="transition-all duration-500 motion-reduce:transition-none"
        enter-from-class="translate-y-8 opacity-0"
        leave-active-class="absolute opacity-0"
      >
        <div
          v-for="message in displayed"
          :key="message.id"
          :class="
            cn(
              'flex shrink-0 items-end gap-2',
              !message.reply && 'flex-row-reverse'
            )
          "
        >
          <span
            :class="
              cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                message.reply
                  ? 'bg-primary-comfy-plum'
                  : 'bg-primary-comfy-yellow text-primary-comfy-ink'
              )
            "
            >{{ message.avatar }}</span
          >
          <div
            :class="
              cn(
                'max-w-17/20 min-w-0 rounded-2xl border px-3 py-2 text-xs leading-relaxed',
                message.reply
                  ? 'border-transparency-white-t20 bg-transparency-white-t4'
                  : 'border-primary-comfy-yellow/30 bg-primary-comfy-ink'
              )
            "
          >
            <span>{{ t(message.text, locale) }}</span>
            <div
              v-if="message.endpoint"
              class="mt-1 break-all text-primary-comfy-yellow"
            >
              {{ message.endpoint }}.run.comfy.app
            </div>
            <div
              v-if="message.snippet"
              class="mt-2 overflow-x-auto rounded-lg bg-primary-comfy-ink/60 px-2 py-1.5 font-mono text-2xs whitespace-pre-wrap text-primary-warm-white/90"
            >
              {{ t(message.snippet, locale) }}
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
