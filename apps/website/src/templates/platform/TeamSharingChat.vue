<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import {
  useDocumentVisibility,
  useElementVisibility,
  useIntervalFn
} from '@vueuse/core'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)
const visibility = useDocumentVisibility()
// Three scripted exchanges, each a different asker paired with B (the one
// deploying workflows): M asks about video upscaling, S about batch
// background removal, R about product shots. Each exchange is ask -> reply
// (with a deployed workflow link) -> thanks, and the three cycle
// continuously, sliding one message at a time through a 4-message window.
// Only the flagship M/B exchange also carries a code snippet; S/B and R/B
// keep their reply to the link, which is enough to read as a distinct,
// lighter-weight exchange without three near-identical snippet blocks.
const exchanges = [
  {
    asker: 'M',
    message: 'platform.howItWorks.chat.message',
    reply: 'platform.howItWorks.chat.reply',
    endpoint: 'video-upscale-4k',
    snippet: 'platform.howItWorks.chat.replySnippet' as const,
    thanks: 'platform.howItWorks.chat.thanks'
  },
  {
    asker: 'S',
    message: 'platform.howItWorks.chat.messageBgRemove',
    reply: 'platform.howItWorks.chat.replyBgRemove',
    endpoint: 'bg-remove-batch',
    snippet: undefined,
    thanks: 'platform.howItWorks.chat.thanksBgRemove'
  },
  {
    asker: 'R',
    message: 'platform.howItWorks.chat.messageProductShots',
    reply: 'platform.howItWorks.chat.replyProductShots',
    endpoint: 'product-shots',
    snippet: undefined,
    thanks: 'platform.howItWorks.chat.thanksProductShots'
  }
] as const
type ChatMessage = {
  id: number
  reply: boolean
  avatar: string
  text:
    | (typeof exchanges)[number]['message']
    | (typeof exchanges)[number]['reply']
    | (typeof exchanges)[number]['thanks']
  endpoint?: string
  snippet?: (typeof exchanges)[number]['snippet']
}
const chatScript: ChatMessage[] = exchanges.flatMap((exchange, index) => [
  {
    id: index * 3,
    reply: false,
    avatar: exchange.asker,
    text: exchange.message
  },
  {
    id: index * 3 + 1,
    reply: true,
    avatar: 'B',
    text: exchange.reply,
    endpoint: exchange.endpoint,
    snippet: exchange.snippet
  },
  {
    id: index * 3 + 2,
    reply: false,
    avatar: exchange.asker,
    text: exchange.thanks
  }
])
// The fixed, reduced-motion frame shows one full exchange (never a
// mid-question cut) rather than the sliding window's cross-exchange overlap.
const initialMessages: ChatMessage[] = chatScript.slice(0, 3)
const tick = ref(2)
const messages = ref<ChatMessage[]>(initialMessages)
const reduced = computed(() => prefersReducedMotion())
const displayed = computed(() =>
  reduced.value ? initialMessages : messages.value
)
const { pause, resume } = useIntervalFn(
  () => {
    tick.value += 1
    const next = chatScript[tick.value % chatScript.length]
    messages.value = [...messages.value.slice(-3), { ...next, id: tick.value }]
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
            <span>{{ t(message.text) }}</span>
            <div
              v-if="message.endpoint"
              class="mt-1 break-all text-primary-comfy-yellow"
            >
              {{ message.endpoint }}.run.comfy.app
            </div>
            <div
              v-if="message.snippet"
              class="mt-2 overflow-x-auto rounded-lg bg-primary-comfy-ink/60 px-2 py-1.5 font-mono text-2xs break-all whitespace-pre-wrap text-primary-warm-white/90"
            >
              {{ t(message.snippet) }}
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
