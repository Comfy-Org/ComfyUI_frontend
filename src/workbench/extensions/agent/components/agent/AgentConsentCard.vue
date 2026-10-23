<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { computed, onMounted, ref, useId } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { cn } from '@comfyorg/tailwind-utils'

import Video from '@/components/common/Video.vue'
import Button from '@/components/ui/button/Button.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { applyDarkPaletteTheme } from '@/utils/colorPaletteTheme'

const {
  title,
  paragraphs,
  videoSources = [],
  posterSrc = '',
  docsUrl = '',
  requiresSignIn = false,
  accepting = false,
  error = ''
} = defineProps<{
  title: string
  paragraphs: string[]
  videoSources?: ComponentProps<typeof Video>['sources']
  posterSrc?: string
  docsUrl?: string
  requiresSignIn?: boolean
  accepting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  reject: []
  accept: []
}>()

const containerRef = ref<HTMLElement>()
const isTwoColumn = useMediaQuery('(min-width: 700px) and (height < 650px)')
const isShortViewport = useMediaQuery('(height < 680px)')
const isCompact = computed(() => isShortViewport.value && !isTwoColumn.value)
const layoutClasses = computed(() => ({
  width: isTwoColumn.value
    ? 'w-[min(960px,calc(100vw-2rem))]'
    : 'w-[min(600px,calc(100vw-2rem))]',
  heading: isCompact.value ? 'text-[22px]/7' : undefined,
  video: isCompact.value
    ? 'max-h-41.5'
    : isTwoColumn.value
      ? 'max-h-[calc(85dvh-2.5rem)]'
      : 'max-h-[min(238px,calc(85dvh-22rem))]',
  fallback: isCompact.value ? 'max-h-41.5' : 'max-h-59.5'
}))
const signInHintId = useId()
const hasConsentHelp = computed(() => Boolean(docsUrl || requiresSignIn))
const acceptAction = computed(() =>
  requiresSignIn
    ? { labelKey: 'agent.consent.agreeAndContinue', describedBy: signInHintId }
    : { labelKey: 'agent.consent.accept', describedBy: undefined }
)

onMounted(() => {
  if (containerRef.value) applyDarkPaletteTheme(containerRef.value.style)
})
</script>

<template>
  <div ref="containerRef" :class="cn('max-w-full', layoutClasses.width)">
    <div
      data-testid="agent-consent-card"
      :class="
        cn(
          'grid max-h-[85dvh] gap-4.5 overflow-y-auto overscroll-contain rounded-2xl border bg-background p-6 shadow-2xl',
          isTwoColumn &&
            'grid-cols-2 grid-rows-[auto_auto] gap-x-7 gap-y-3.5 p-5',
          isCompact && 'gap-3 p-4.5'
        )
      "
    >
      <div :class="cn('min-w-0', isTwoColumn && 'row-span-2 self-center')">
        <Video
          :sources="videoSources"
          :poster-src="posterSrc"
          autoplay
          muted
          loop
          plays-inline
          data-testid="agent-consent-video"
          :class="
            cn(
              'mx-auto aspect-video w-full max-w-full rounded-lg object-contain',
              layoutClasses.video
            )
          "
        >
          <template #fallback>
            <div
              :class="
                cn(
                  'grid aspect-video w-full place-items-center rounded-lg bg-secondary text-xs text-muted-foreground',
                  layoutClasses.fallback
                )
              "
            >
              {{ $t('agent.consent.videoPlaceholder') }}
            </div>
          </template>
        </Video>
      </div>

      <section
        :class="
          cn(
            'flex min-w-0 flex-col gap-3',
            isTwoColumn && 'col-start-2 row-start-1 gap-2.5',
            isCompact && 'gap-2'
          )
        "
      >
        <DialogTitle :class="cn('my-0 text-2xl/7.5', layoutClasses.heading)">
          {{ title }}
        </DialogTitle>
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          :class="
            cn(
              'my-0 text-sm/5 text-muted-foreground',
              isCompact && 'text-[13px]/4.5'
            )
          "
        >
          {{ paragraph }}
        </p>
        <p v-if="error" role="alert" class="my-0 text-sm/5 text-destructive">
          {{ error }}
        </p>
      </section>

      <footer
        :class="
          cn(
            'flex min-w-0 flex-col gap-2.5',
            isTwoColumn && 'col-start-2 row-start-2'
          )
        "
      >
        <div
          v-if="hasConsentHelp"
          class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"
        >
          <Button
            v-if="docsUrl"
            variant="link"
            size="link"
            class="w-fit py-0 text-xs/5"
            as="a"
            :href="docsUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ $t('agent.consent.readDocs') }}
            <span class="icon-[lucide--square-arrow-out-up-right] size-3" />
          </Button>
          <p
            v-if="requiresSignIn"
            :id="signInHintId"
            class="my-0 text-xs/5 text-muted-foreground"
          >
            {{ $t('agent.consent.signInNext') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2.5">
          <Button
            v-if="!accepting"
            variant="secondary"
            size="lg"
            class="h-auto min-h-11 max-w-full whitespace-normal"
            @click="emit('reject')"
          >
            {{ $t('agent.consent.reject') }}
          </Button>
          <Button
            variant="inverted"
            size="lg"
            class="h-auto min-h-11 max-w-full flex-1 whitespace-normal"
            :loading="accepting"
            :disabled="accepting"
            :aria-describedby="acceptAction.describedBy"
            @click="emit('accept')"
          >
            {{ $t(acceptAction.labelKey) }}
          </Button>
        </div>
      </footer>
    </div>
  </div>
</template>
