<script setup lang="ts">
import {
  createReusableTemplate,
  useMediaQuery,
  useResizeObserver
} from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { cn } from '@comfyorg/tailwind-utils'

import Video from '@comfyorg/design-system/media/Video'
import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Message from '@comfyorg/design-system/message/Message'
import { applyDarkPaletteTheme } from '@/utils/colorPaletteTheme'
import { openFeedbackDialog } from '@/workbench/extensions/agent/feedback'
import type { ConsentCardError } from '@/workbench/extensions/agent/types/consentCardError'

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
  error?: ConsentCardError | ''
}>()

const emit = defineEmits<{
  reject: []
  accept: []
}>()

const WIDE_MIN_WIDTH = 576
const ERROR_TITLE_KEY = {
  save: 'agent.consent.errorTitle',
  load: 'agent.consent.loadErrorTitle',
  signIn: 'agent.consent.signInErrorTitle'
} as const satisfies Record<ConsentCardError, string>
const CARD_SHELL =
  'grid max-h-[85dvh] overflow-y-auto overscroll-contain rounded-2xl border bg-background shadow-2xl'
const MEDIA_SHELL = 'w-full rounded-lg object-cover'
const FALLBACK_SHELL =
  'grid w-full place-items-center rounded-lg bg-secondary text-xs text-muted-foreground'
const COPY_SHELL = 'my-0 text-sm/5 text-muted-foreground'
const SECTION_SHELL = 'flex min-w-0 flex-col gap-3'
const FOOTER_WIDE =
  'flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2'
const FOOTER_NARROW = 'flex min-w-0 flex-col gap-2.5'
const [DefineDocsLink, ReuseDocsLink] = createReusableTemplate()

const LAYOUTS = {
  stacked: {
    width: 'w-[min(600px,calc(100vw-2rem))]',
    card: cn(CARD_SHELL, 'gap-0 p-0'),
    videoWrap: 'w-full min-w-0 p-2',
    media: cn(MEDIA_SHELL, 'aspect-video'),
    fallback: cn(FALLBACK_SHELL, 'aspect-video'),
    heading: 'my-0 text-2xl/7.5',
    copy: COPY_SHELL,
    contentWrap: 'flex min-w-0 flex-col',
    section: cn(SECTION_SHELL, 'px-6 pt-4.5'),
    sectionNarrow: cn(SECTION_SHELL, 'gap-2 px-4.5 pt-3'),
    footer: cn(FOOTER_WIDE, 'px-6 pt-4.5 pb-6'),
    footerNarrow: cn(FOOTER_NARROW, 'px-4.5 pt-3 pb-4.5')
  },
  compact: {
    width: 'w-[min(600px,calc(100vw-2rem))]',
    card: cn(CARD_SHELL, 'h-[85dvh] grid-rows-[minmax(0,1fr)_auto] gap-0 p-0'),
    videoWrap:
      '[container-type:size] grid h-full min-h-0 w-full place-items-center overflow-hidden p-2 [&>div.relative]:grid [&>div.relative]:size-full [&>div.relative]:place-items-center',
    media:
      'aspect-video w-[min(100cqw,calc(100cqh*16/9))] max-h-full rounded-lg object-contain',
    fallback: cn(
      FALLBACK_SHELL,
      'aspect-video max-h-full w-[min(100cqw,calc(100cqh*16/9))]'
    ),
    heading: 'my-0 text-2xl/7.5 text-[22px]/7',
    copy: cn(COPY_SHELL, 'text-[13px]/4.5'),
    contentWrap: 'flex min-w-0 flex-col',
    section: cn(SECTION_SHELL, 'gap-2 px-4.5 pt-3'),
    sectionNarrow: cn(SECTION_SHELL, 'gap-2 px-4.5 pt-3'),
    footer: cn(FOOTER_WIDE, 'px-4.5 pt-3 pb-4.5'),
    footerNarrow: cn(FOOTER_NARROW, 'px-4.5 pt-3 pb-4.5')
  },
  columns: {
    width: 'w-[min(960px,calc(100vw-2rem))]',
    card: cn(CARD_SHELL, 'grid-cols-2 items-stretch gap-x-7 p-2'),
    videoWrap:
      '[container-type:size] grid h-0 min-h-full w-full min-w-0 place-items-center self-stretch overflow-hidden rounded-lg [&>div.relative]:grid [&>div.relative]:size-full [&>div.relative]:place-items-center',
    media:
      'aspect-video w-[min(100cqw,calc(100cqh*16/9))] max-h-full rounded-lg object-contain',
    fallback: cn(
      FALLBACK_SHELL,
      'aspect-video max-h-full w-[min(100cqw,calc(100cqh*16/9))]'
    ),
    heading: 'my-0 text-2xl/7.5',
    copy: COPY_SHELL,
    contentWrap: 'flex min-w-0 flex-col justify-between gap-3.5 pt-3 pr-3 pb-3',
    section: cn(SECTION_SHELL, 'gap-2.5'),
    sectionNarrow: cn(SECTION_SHELL, 'gap-2.5'),
    footer: FOOTER_WIDE,
    footerNarrow: FOOTER_NARROW
  }
} as const

const containerRef = ref<HTMLElement>()
const isWide = ref(true)
const isTwoColumn = useMediaQuery('(min-width: 700px) and (height < 650px)')
const isShortViewport = useMediaQuery('(height < 680px)')

function layoutMode(): keyof typeof LAYOUTS {
  if (isTwoColumn.value) return 'columns'
  if (isShortViewport.value) return 'compact'
  return 'stacked'
}

const mode = computed(() => layoutMode())
const layout = computed(() => LAYOUTS[mode.value])
const headingClass = computed(() =>
  isWide.value ? layout.value.heading : 'my-0 text-xl'
)
const sectionClass = computed(() =>
  isWide.value ? layout.value.section : layout.value.sectionNarrow
)
const footerClass = computed(() =>
  isWide.value ? layout.value.footer : layout.value.footerNarrow
)
const actions = computed(() => {
  if (accepting) return ['accept'] as const
  return isWide.value
    ? (['reject', 'accept'] as const)
    : (['accept', 'reject'] as const)
})
const actionButtonClass = computed(() =>
  isWide.value
    ? 'h-auto min-h-11 w-fit max-w-full whitespace-normal'
    : 'h-auto min-h-11 w-full max-w-full whitespace-normal'
)
const actionRowClass = computed(() =>
  isWide.value
    ? 'ml-auto flex flex-wrap items-center justify-end gap-2.5'
    : 'flex w-full flex-col gap-2.5'
)
const acceptLabelKey = computed(() => {
  if (error) return 'agent.consent.tryAgain'
  return requiresSignIn
    ? 'agent.consent.agreeAndContinue'
    : 'agent.consent.accept'
})
const errorTitleKey = computed(() => (error ? ERROR_TITLE_KEY[error] : ''))
const errorVisible = ref(Boolean(error))

watch(
  () => error,
  (value) => {
    if (value) errorVisible.value = true
  }
)

function openConsentFeedback(): void {
  openFeedbackDialog('agent-consent')
}

useResizeObserver(containerRef, ([entry]) => {
  const width = entry.contentRect.width
  if (width === 0) return
  isWide.value = width >= WIDE_MIN_WIDTH
})

function choose(action: 'accept' | 'reject'): void {
  if (action === 'accept') emit('accept')
  else emit('reject')
}

onMounted(() => {
  if (containerRef.value) applyDarkPaletteTheme(containerRef.value.style)
})
</script>

<template>
  <DefineDocsLink>
    <Button
      variant="link"
      size="unset"
      class="mr-auto w-fit gap-1 px-0 py-2 text-sm/5 font-normal hover:underline"
      as="a"
      :href="docsUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ $t('agent.consent.readDocs') }}
      <i class="icon-[lucide--square-arrow-out-up-right]" />
    </Button>
  </DefineDocsLink>

  <div ref="containerRef" :class="cn('max-w-full', layout.width)">
    <div data-testid="agent-consent-card" :class="layout.card">
      <div :class="layout.videoWrap">
        <Video
          :sources="videoSources"
          :poster-src="posterSrc"
          autoplay
          muted
          loop
          plays-inline
          data-testid="agent-consent-video"
          :class="layout.media"
        >
          <template #fallback>
            <div :class="layout.fallback">
              {{ $t('agent.consent.videoPlaceholder') }}
            </div>
          </template>
        </Video>
      </div>

      <div :class="layout.contentWrap">
        <section :class="sectionClass">
          <DialogTitle :class="headingClass">
            {{ title }}
          </DialogTitle>
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            :class="layout.copy"
          >
            {{ paragraph }}
          </p>
          <ReuseDocsLink v-if="docsUrl && !isWide" />
          <Message
            v-if="error"
            v-model:visible="errorVisible"
            severity="error"
            closable
            :close-label="$t('g.close')"
          >
            <template #icon>
              <i class="icon-[lucide--circle-x] size-5 text-destructive" />
            </template>
            <div class="flex min-w-0 flex-col gap-0.5">
              <p class="my-0 font-medium">
                {{ $t(errorTitleKey) }}
              </p>
              <p class="my-0 text-muted-foreground">
                <i18n-t keypath="agent.consent.errorContact" tag="span">
                  <template #contactForm>
                    <Button
                      type="button"
                      variant="link"
                      size="unset"
                      class="inline h-auto p-0 font-normal underline"
                      @click="openConsentFeedback"
                    >
                      {{ $t('agent.consent.contactForm') }}
                    </Button>
                  </template>
                </i18n-t>
              </p>
            </div>
          </Message>
        </section>

        <footer :class="footerClass">
          <ReuseDocsLink v-if="docsUrl && isWide" />
          <div :class="actionRowClass">
            <Button
              v-for="action in actions"
              :key="action"
              :variant="action === 'accept' ? 'inverted' : 'secondary'"
              size="lg"
              :class="actionButtonClass"
              :loading="action === 'accept' && accepting"
              :disabled="accepting"
              @click="choose(action)"
            >
              {{
                action === 'accept'
                  ? $t(acceptLabelKey)
                  : $t('agent.consent.reject')
              }}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>
