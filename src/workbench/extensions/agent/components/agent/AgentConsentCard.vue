<script setup lang="ts">
import { createReusableTemplate, useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@/components/common/Video.vue'
import Button from '@/components/ui/button/Button.vue'

const {
  title,
  titleId,
  paragraphs,
  videoSources = [],
  posterSrc = '',
  docsUrl = '',
  accepting = false,
  error = ''
} = defineProps<{
  title: string
  titleId?: string
  paragraphs: string[]
  videoSources?: ComponentProps<typeof Video>['sources']
  posterSrc?: string
  docsUrl?: string
  accepting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  reject: []
  accept: []
}>()

const CONTAINER_XL_MIN_WIDTH = 576
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()
const containerRef = ref<HTMLElement>()
const isWide = ref(false)
const actions = computed(() => {
  if (accepting) return ['accept'] as const
  return isWide.value
    ? (['reject', 'accept'] as const)
    : (['accept', 'reject'] as const)
})

useResizeObserver(containerRef, ([entry]) => {
  isWide.value = entry.contentRect.width >= CONTAINER_XL_MIN_WIDTH
})

function choose(action: 'accept' | 'reject'): void {
  if (action === 'accept') emit('accept')
  else emit('reject')
}
</script>

<template>
  <DefineDocsLink>
    <Button
      variant="link"
      size="link"
      class="mr-auto w-fit"
      as="a"
      :href="docsUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ $t('agent.consent.readDocs') }}
      <span class="icon-[lucide--square-arrow-out-up-right] size-4" />
    </Button>
  </DefineDocsLink>

  <div ref="containerRef" class="dark-theme @container w-full max-w-[640px]">
    <div
      data-testid="agent-consent-card"
      class="max-h-[85dvh] overflow-y-auto rounded-2xl border border-component-node-border bg-base-background shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25),0_3px_3px_-1.5px_rgba(10,13,18,0.2)]"
    >
      <div class="p-2">
        <Video
          :sources="videoSources"
          :poster-src="posterSrc"
          autoplay
          muted
          loop
          plays-inline
          data-testid="agent-consent-video"
          class="aspect-video w-full rounded-lg object-cover"
        >
          <template #fallback>
            <div
              class="grid aspect-video w-full place-items-center rounded-lg bg-secondary-background text-xs text-muted-foreground"
            >
              {{ $t('agent.consent.videoPlaceholder') }}
            </div>
          </template>
        </Video>
      </div>

      <section class="flex flex-col gap-9 p-6 @xl:gap-6 @xl:p-9">
        <div class="flex flex-col gap-4">
          <h2
            :id="titleId"
            class="my-0 text-xl font-semibold text-base-foreground @xl:text-2xl"
          >
            {{ title }}
          </h2>
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="my-0 text-sm/5 text-muted-foreground"
          >
            {{ paragraph }}
          </p>

          <ReuseDocsLink v-if="docsUrl && !isWide" />

          <p
            v-if="error"
            role="alert"
            class="my-0 text-sm/5 text-destructive-background"
          >
            {{ error }}
          </p>
        </div>

        <footer
          class="flex flex-col gap-2.5 @xl:flex-row @xl:flex-wrap @xl:items-center @xl:justify-end"
        >
          <ReuseDocsLink v-if="docsUrl && isWide" />

          <div
            class="flex max-w-full flex-col gap-2.5 @xl:flex-row @xl:flex-wrap @xl:justify-end"
          >
            <Button
              v-for="action in actions"
              :key="action"
              :variant="action === 'accept' ? 'inverted' : 'secondary'"
              size="lg"
              class="w-full @xl:w-auto"
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
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>
