<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import NodeBadge from '../common/NodeBadge.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const features = [
  {
    title: t('showcase.feature1.title', locale),
    description: t('showcase.feature1.description', locale),
    video: 'https://media.comfy.org/website/homepage/showcase/ui-overview.webm'
  },
  {
    title: t('showcase.feature2.title', locale),
    description: t('showcase.feature2.description', locale),
    video:
      'https://media.comfy.org/website/homepage/showcase/node-workflow.webm'
  },
  {
    title: t('showcase.feature3.title', locale),
    description: t('showcase.feature3.description', locale),
    video:
      'https://media.comfy.org/website/homepage/showcase/video-showcase.webm'
  }
]

const badgeSegments = [
  { text: t('showcase.badgeHow', locale) },
  { logoSrc: '/icons/logo.svg', logoAlt: 'Comfy' },
  { text: t('showcase.badgeWorks', locale) }
]

const activeIndex = ref(0)
const videoRefs = ref<HTMLVideoElement[]>([])

watch(activeIndex, (current, previous) => {
  videoRefs.value[previous]?.pause()
  const active = videoRefs.value[current]
  if (active) {
    active.currentTime = 0
    active.play().catch(() => {})
  }
})
</script>

<template>
  <section class="px-4 py-20 lg:px-20 lg:py-24">
    <!-- Section header -->
    <div class="flex flex-col items-center text-center">
      <NodeBadge :segments="badgeSegments" segment-class="" />
      <p class="text-primary-comfy-canvas mt-12 max-w-xl text-sm/relaxed">
        {{ t('showcase.subtitle1', locale) }}
      </p>
      <p class="text-primary-comfy-canvas mt-4 max-w-xl text-sm/relaxed">
        {{ t('showcase.subtitle2', locale) }}
      </p>
    </div>

    <!-- Content area -->
    <div class="mt-12 flex flex-col lg:mt-24 lg:flex-row lg:items-stretch">
      <!-- Video area (desktop only) -->
      <div class="hidden flex-1 lg:flex">
        <div
          class="rounded-5xl relative flex w-full items-center justify-center overflow-hidden p-0.5 [clip-path:inset(0_round_var(--radius-5xl))]"
        >
          <div
            class="animate-border-spin absolute top-1/2 left-1/2 aspect-square min-h-full min-w-full -translate-1/2 scale-150"
            style="
              background: conic-gradient(
                from 0deg,
                color-mix(
                    in srgb,
                    var(--color-primary-comfy-yellow) 4%,
                    transparent
                  )
                  0%,
                var(--color-primary-comfy-yellow) 100%
              );
            "
          />
          <div
            class="bg-primary-comfy-ink relative size-full overflow-hidden rounded-[calc(2.5rem-2px)]"
          >
            <video
              v-for="(feature, i) in features"
              :ref="
                (el) => {
                  if (el) videoRefs[i] = el as HTMLVideoElement
                }
              "
              :key="feature.title"
              :src="feature.video"
              :autoplay="i === 0"
              loop
              muted
              playsinline
              :class="
                cn(
                  'absolute inset-0 size-full object-cover transition-opacity duration-300',
                  activeIndex === i ? 'opacity-100' : 'opacity-0'
                )
              "
            />
          </div>
        </div>
      </div>

      <!-- Feature accordion -->
      <div class="flex w-full flex-col lg:w-85 lg:gap-4">
        <template v-for="(feature, i) in features" :key="feature.title">
          <!-- Video area (mobile, rendered before active item) -->
          <div
            v-if="activeIndex === i"
            :class="
              cn(
                'aspect-video overflow-hidden rounded-4xl lg:hidden',
                i !== 0 && 'mt-4'
              )
            "
          >
            <video
              :src="feature.video"
              autoplay
              loop
              muted
              playsinline
              class="size-full object-cover"
            />
          </div>

          <!-- Connector (mobile) -->
          <div
            v-if="activeIndex === i"
            class="flex h-5 items-center overflow-visible lg:hidden"
          >
            <img
              src="/icons/node-link.svg"
              alt=""
              class="ml-20 h-8 w-5 rotate-90"
              aria-hidden="true"
            />
          </div>

          <!-- Accordion item with connector -->
          <div
            :class="
              cn('flex items-stretch', activeIndex !== i && 'mt-4 lg:mt-0')
            "
          >
            <img
              v-if="activeIndex === i"
              src="/icons/node-link.svg"
              alt=""
              class="hidden self-center lg:block"
              aria-hidden="true"
            />
            <button
              type="button"
              :class="
                cn(
                  'rounded-5xl w-full cursor-pointer p-8 text-left transition-colors duration-300',
                  activeIndex === i
                    ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
                    : 'bg-transparency-white-t4 text-primary-comfy-canvas lg:ml-5'
                )
              "
              @click="activeIndex = i"
            >
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-2xl/tight font-medium">
                  {{ feature.title }}
                </h3>
                <img
                  src="/icons/plus.svg"
                  alt=""
                  :class="
                    cn(
                      'size-5 shrink-0 transition-opacity duration-300',
                      activeIndex === i ? 'opacity-0' : 'opacity-100'
                    )
                  "
                  aria-hidden="true"
                />
              </div>

              <!-- Animated description (stacked for constant height) -->
              <div
                :class="
                  cn(
                    'grid transition-[grid-template-rows] duration-300',
                    activeIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )
                "
              >
                <div class="grid overflow-hidden">
                  <p
                    v-for="(f, j) in features"
                    :key="f.title"
                    :class="
                      cn(
                        'col-start-1 row-start-1 mt-4 text-sm/relaxed font-normal opacity-80',
                        j === i ? 'visible' : 'invisible'
                      )
                    "
                  >
                    {{ f.description }}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
