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

const { locale = 'en', endpoint } = defineProps<{
  locale?: Locale
  endpoint: string
}>()
const root = useTemplateRef<HTMLElement>('root')
const visible = useElementVisibility(root)
const visibility = useDocumentVisibility()
const exchanges = [
  {
    message: 'platform.howItWorks.chat.message',
    reply: 'platform.howItWorks.chat.reply',
    responder: 'J'
  },
  {
    message: 'platform.howItWorks.chat.messageReady',
    reply: 'platform.howItWorks.chat.replyTesting',
    responder: 'M'
  },
  {
    message: 'platform.howItWorks.chat.messagePreview',
    reply: 'platform.howItWorks.chat.replySharing',
    responder: 'Q'
  }
] as const
type ChatMessage = {
  id: number
  reply: boolean
  endpoint: string
  avatar: string
  text: (typeof exchanges)[number]['message' | 'reply']
}
const initialMessages: ChatMessage[] = [
  { id: 5, reply: false, endpoint, avatar: 'B', text: exchanges[1].message },
  {
    id: 7,
    reply: true,
    endpoint,
    avatar: exchanges[1].responder,
    text: exchanges[1].reply
  },
  { id: 9, reply: false, endpoint, avatar: 'B', text: exchanges[2].message },
  {
    id: 11,
    reply: true,
    endpoint,
    avatar: exchanges[2].responder,
    text: exchanges[2].reply
  }
]
const tick = ref(11)
const messages = ref<ChatMessage[]>(initialMessages)
const reduced = computed(() => prefersReducedMotion())
const displayed = computed(() =>
  reduced.value ? initialMessages : messages.value
)
const { pause, resume } = useIntervalFn(
  () => {
    tick.value += 1
    if (tick.value % 2 === 1) {
      const reply = tick.value % 4 === 3
      const exchange =
        exchanges[Math.floor((tick.value - 1) / 4) % exchanges.length]
      messages.value = [
        ...messages.value.slice(-3),
        {
          id: tick.value,
          reply,
          endpoint,
          avatar: reply ? exchange.responder : 'B',
          text: reply ? exchange.reply : exchange.message
        }
      ]
    }
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
          class="flex shrink-0 items-end gap-2"
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
                'max-w-[85%] min-w-0 rounded-2xl border px-3 py-2 text-xs leading-relaxed',
                message.reply
                  ? 'border-transparency-white-t20 bg-transparency-white-t4'
                  : 'border-primary-comfy-yellow/30 bg-primary-comfy-ink'
              )
            "
          >
            <span>{{ t(message.text, locale) }}</span>
            <div
              v-if="!message.reply"
              class="mt-1 break-all text-primary-comfy-yellow"
            >
              {{ message.endpoint }}.run.comfy.app
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
