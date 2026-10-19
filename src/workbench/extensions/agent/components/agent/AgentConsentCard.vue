<script setup lang="ts">
import { createReusableTemplate, useResizeObserver } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import Video from '@/components/common/Video.vue'
import Button from '@/components/ui/button/Button.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Message from '@/components/ui/message/Message.vue'
import { applyDarkPaletteTheme } from '@/utils/colorPaletteTheme'

const {
  title,
  paragraphs,
  videoSources = [],
  posterSrc = '',
  docsUrl = '',
  accepting = false,
  error = ''
} = defineProps<{
  title: string
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

onMounted(() => {
  if (containerRef.value) applyDarkPaletteTheme(containerRef.value.style)
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

  <div
    ref="containerRef"
    class="@container w-[min(640px,calc(100vw-2rem))] max-w-full"
  >
    <div
      data-testid="agent-consent-card"
      class="max-h-[85dvh] overflow-y-auto rounded-2xl border border-border bg-background shadow-lg"
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
              class="grid aspect-video w-full place-items-center rounded-lg bg-secondary text-xs text-muted-foreground"
            >
              {{ $t('agent.consent.videoPlaceholder') }}
            </div>
          </template>
        </Video>
      </div>

      <section class="flex flex-col gap-4 px-4 py-2">
        <div class="flex flex-col gap-4">
          <DialogTitle class="my-0">
            {{ title }}
          </DialogTitle>
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="my-0 text-sm/5 text-muted-foreground"
          >
            {{ paragraph }}
          </p>

          <ReuseDocsLink v-if="docsUrl && !isWide" />

          <Message v-if="error" severity="error">
            {{ error }}
          </Message>
        </div>
      </section>
      <DialogFooter class="flex-col @xl:flex-row @xl:flex-wrap">
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
      </DialogFooter>
    </div>
  </div>
</template>
