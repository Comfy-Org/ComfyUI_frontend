<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  title,
  titleId,
  paragraphs,
  videoSrc = '',
  docsUrl = '',
  accepting = false,
  error = ''
} = defineProps<{
  title: string
  titleId?: string
  paragraphs: string[]
  videoSrc?: string
  docsUrl?: string
  accepting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  reject: []
  accept: []
}>()

const WIDE_LAYOUT_MIN_WIDTH = 672
const containerRef = ref<HTMLElement>()
const isWide = ref(false)
const videoFailed = ref(false)
const actions = computed(() => {
  if (accepting) return ['accept'] as const
  return isWide.value
    ? (['reject', 'accept'] as const)
    : (['accept', 'reject'] as const)
})

useResizeObserver(containerRef, ([entry]) => {
  isWide.value = entry.contentRect.width >= WIDE_LAYOUT_MIN_WIDTH
})

function choose(action: 'accept' | 'reject'): void {
  if (action === 'accept') emit('accept')
  else emit('reject')
}

function openDocs(): void {
  window.open(docsUrl, '_blank', 'noopener')
}
</script>

<template>
  <div ref="containerRef" class="@container w-full max-w-[1040px]">
    <div
      class="bg-agent-surface border-agent-border grid max-h-[90dvh] grid-cols-1 overflow-hidden rounded-2xl border shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25),0_3px_3px_-1.5px_rgba(10,13,18,0.2)] @2xl:min-h-[543px] @2xl:grid-cols-[555fr_483fr]"
    >
      <div class="shrink-0 p-2">
        <video
          v-if="videoSrc && !videoFailed"
          :src="videoSrc"
          data-testid="agent-consent-video"
          class="aspect-square w-full rounded-xl object-cover @2xl:aspect-auto @2xl:size-full"
          autoplay
          muted
          loop
          playsinline
          @error="videoFailed = true"
        />
        <div
          v-else
          class="text-agent-fg-muted bg-agent-surface-raised grid aspect-square w-full place-items-center rounded-xl text-xs @2xl:aspect-auto @2xl:size-full"
        >
          {{ $t('agent.consent.videoPlaceholder') }}
        </div>
      </div>

      <section class="flex min-h-0 flex-col gap-9 overflow-y-auto p-6 @2xl:p-9">
        <div class="hidden flex-1 @2xl:block" />

        <div class="flex flex-col gap-4">
          <h2
            :id="titleId"
            class="text-agent-fg my-0 text-xl font-semibold @2xl:text-2xl"
          >
            {{ title }}
          </h2>
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="text-agent-fg-muted my-0 text-sm/5"
          >
            {{ paragraph }}
          </p>

          <Button
            v-if="docsUrl"
            variant="link"
            size="unset"
            class="w-fit gap-1 px-0 py-2 text-sm/5 font-normal hover:underline"
            @click="openDocs"
          >
            {{ $t('agent.consent.readDocs') }}
            <span class="icon-[lucide--square-arrow-out-up-right] size-4" />
          </Button>

          <p v-if="error" role="alert" class="text-agent-danger my-0 text-sm/5">
            {{ error }}
          </p>
        </div>

        <footer class="flex flex-col gap-2.5 @2xl:flex-row @2xl:justify-end">
          <Button
            v-for="action in actions"
            :key="action"
            :variant="action === 'accept' ? 'inverted' : 'textonly'"
            size="md"
            class="w-full @2xl:w-auto"
            :loading="action === 'accept' && accepting"
            :disabled="accepting"
            @click="choose(action)"
          >
            {{
              action === 'accept'
                ? $t('agent.consent.accept')
                : $t('agent.consent.reject')
            }}
          </Button>
        </footer>
      </section>
    </div>
  </div>
</template>
