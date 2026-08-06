<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useElementVisibility } from '@vueuse/core'
import {
  computed,
  onScopeDispose,
  ref,
  useId,
  useTemplateRef,
  watch
} from 'vue'

import { prefersReducedMotion } from '../../composables/useReducedMotion'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { externalLinks } from '../../config/routes'
import BrandButton from '../common/BrandButton.vue'
import BlobMedia from './BlobMedia.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface Industry {
  label: string
  primarySrc: string
  secondarySrc: string
  /** Bottom tile in the cluster. Industries still awaiting a bespoke reel
   * fall back to the shared community one. */
  ambientSrc: string
  secondaryObjectPosition?: 'top' | 'bottom' | 'center'
}

const MEDIA_BASE = 'https://media.comfy.org/website/homepage/use-case'

/** Shared community reel used until each industry has its own ambient clip. */
const fallbackAmbientSrc = `${MEDIA_BASE}/left5.webm`

const industries: Industry[] = [
  {
    label: t('industries.vfx', locale),
    primarySrc: `${MEDIA_BASE}/left1.webm`,
    secondarySrc: `${MEDIA_BASE}/right1.webm`,
    ambientSrc: '/industries/ambient-vfx-animation.webm'
  },
  {
    label: t('industries.advertising', locale),
    primarySrc: `${MEDIA_BASE}/left2.webm`,
    secondarySrc: `${MEDIA_BASE}/right2.webm`,
    ambientSrc: fallbackAmbientSrc
  },
  {
    label: t('industries.gaming', locale),
    primarySrc: `${MEDIA_BASE}/left3.webm`,
    secondarySrc: `${MEDIA_BASE}/right3.webp`,
    ambientSrc: fallbackAmbientSrc
  },
  {
    label: t('industries.ecommerce', locale),
    primarySrc: `${MEDIA_BASE}/left4.webm`,
    secondarySrc: `${MEDIA_BASE}/right4.webm`,
    ambientSrc: fallbackAmbientSrc,
    secondaryObjectPosition: 'top'
  }
]

const activeIndex = ref(0)
const active = computed(() => industries[activeIndex.value])

/** The list demos itself: starting from VFX & Animation it advances to the
 * next industry every few seconds while the section is on screen. Rolling
 * over an item hands control to the visitor — the cycle holds there for as
 * long as they interact, then resumes from that industry once they go idle.
 * Disabled under prefers-reduced-motion. */
const DWELL_MS = 3000
/** Coming off a hover the cycle picks back up on a shorter fuse than the
 * regular cadence, so the demo doesn't feel stalled after interaction. */
const RESUME_MS = 1500

const sectionRef = useTemplateRef<HTMLElement>('sectionRef')
const onScreen = useElementVisibility(sectionRef)
const hovering = ref(false)

let dwellTimer: ReturnType<typeof setTimeout> | undefined

function schedule(delay: number) {
  clearTimeout(dwellTimer)
  dwellTimer = undefined
  if (!onScreen.value || prefersReducedMotion()) return
  dwellTimer = setTimeout(() => {
    if (!hovering.value)
      activeIndex.value = (activeIndex.value + 1) % industries.length
    schedule(DWELL_MS)
  }, delay)
}

watch(onScreen, () => schedule(DWELL_MS), { immediate: true })
onScopeDispose(() => clearTimeout(dwellTimer))

/** A rollover/click/focus selects the industry and restarts the dwell clock,
 * so the cycle always waits a full beat before moving on from the visitor's
 * choice. */
function select(index: number) {
  activeIndex.value = index
  schedule(DWELL_MS)
}

const uid = useId()
const primaryClipId = `industries-primary-${uid}`
const secondaryClipId = `industries-secondary-${uid}`
const ambientClipId = `industries-ambient-${uid}`
</script>

<template>
  <section
    ref="sectionRef"
    class="relative overflow-x-clip bg-primary-comfy-ink"
  >
    <!-- Node silhouettes exported from the Figma industries mock, normalized
    to each shape's bounding box for objectBoundingBox clipping. -->
    <svg class="absolute size-0" width="0" height="0" aria-hidden="true">
      <defs>
        <clipPath :id="primaryClipId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.88699,0.00428C0.93465,-0.00742 0.98416,0.00571 0.99763,0.03363C0.99984,0.0382 0.99987,0.04303 1,0.0477L1,0.18106C1.00004,0.1849 0.99975,0.18873 0.99915,0.19255L0.99968,0.19255L0.99968,0.62509C0.99986,0.62622 0.99997,0.62735 1,0.62849L1,0.76083C1.0002,0.81011 0.94339,0.85946 0.86136,0.8796L0.3895,0.99572C0.34184,1.00742 0.29234,0.99429 0.27886,0.96637C0.27665,0.9618 0.27577,0.95704 0.27558,0.95225L0.27619,0.86215C0.27629,0.85991 0.2757,0.85771 0.27469,0.85561C0.26873,0.84325 0.24687,0.83756 0.22599,0.84269L0.11464,0.87003C0.06677,0.88178 0.017,0.86858 0.00346,0.84053C0.00119,0.83584 -0.00002,0.83088 0,0.82604L0,0.49932C0.001,0.45057 0.05603,0.40216 0.13722,0.38223L0.25047,0.35442C0.26776,0.35018 0.27904,0.33981 0.2792,0.32941L0.27967,0.2385C0.2798,0.18942 0.3334,0.14019 0.41523,0.1201L0.88699,0.00428Z"
          />
        </clipPath>
        <clipPath :id="secondaryClipId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.27702,0.05303C0.27683,0.00533 0.33028,-0.01378 0.4122,0.01062L0.88452,0.1513C0.93223,0.16551 0.98196,0.20488 0.99565,0.23929C0.99789,0.24493 0.99904,0.25025 0.9992,0.25486L0.9992,0.27421L1,0.27421L1,0.82954L0.9992,0.82954L0.9992,0.94651C0.99972,0.99458 0.94651,1.01385 0.86438,0.98938L0.39197,0.84894C0.34425,0.83473 0.29452,0.79536 0.28083,0.76095C0.27859,0.75531 0.27768,0.75021 0.27745,0.74545L0.2775,0.65808C0.27758,0.65596 0.27698,0.6535 0.27595,0.65091C0.26989,0.63569 0.24794,0.61841 0.22704,0.61218L0.11555,0.57898C0.06762,0.5647 0.01763,0.52512 0.00388,0.49055C0.00157,0.48477 0.00032,0.47929 0.00032,0.47459L0,0.15762C0.00069,0.11072 0.0538,0.09217 0.1351,0.11639L0.24848,0.15016C0.26579,0.15531 0.27703,0.15128 0.27713,0.14124L0.27702,0.05303Z"
          />
        </clipPath>
        <clipPath :id="ambientClipId" clipPathUnits="objectBoundingBox">
          <path
            d="M0.7682,0.03391C0.72925,-0.01012 0.67314,-0.01048 0.63146,0.0282L0.55423,0.09966C0.54536,0.10776 0.53354,0.10769 0.52531,0.09839L0.47141,0.03745C0.43277,-0.00624 0.3774,-0.00696 0.33578,0.03081L0.07596,0.27111C0.0445,0.30259 0.03238,0.3716 0.06823,0.42508L0.10455,0.46614C0.11449,0.47738 0.11551,0.49787 0.10663,0.51199C0.10512,0.51439 0.10341,0.51657 0.10148,0.51826L0.02488,0.58898C0.02087,0.59291 0.01707,0.59731 0.01378,0.60254C-0.0063,0.63446 -0.00419,0.68107 0.0185,0.70672L0.24619,0.96612C0.28524,1.01026 0.34143,1.01048 0.38319,0.9714L0.49471,0.86838L0.4949,0.86835C0.49627,0.8671 0.49762,0.86577 0.49892,0.86436L0.93835,0.4499L0.97144,0.41943C1.00426,0.38907 1.01088,0.31062 0.98033,0.27374L0.7682,0.03391Z"
          />
        </clipPath>
      </defs>
    </svg>

    <div
      class="max-w-9xl mx-auto grid grid-cols-1 gap-16 px-6 py-20 lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-20 lg:py-28"
    >
      <!-- Copy column -->
      <div class="flex flex-col items-start gap-10">
        <div class="flex flex-col gap-6">
          <p
            class="text-primary-comfy-yellow text-sm font-bold tracking-widest uppercase"
          >
            {{ t('industries.label', locale) }}
          </p>
          <p class="text-primary-warm-gray max-w-md text-lg/relaxed">
            {{ t('industries.body', locale) }}
          </p>
        </div>

        <nav
          class="flex flex-col items-start gap-7"
          :aria-label="t('industries.navLabel', locale)"
          @pointerenter="hovering = true"
          @pointerleave="((hovering = false), schedule(RESUME_MS))"
        >
          <button
            v-for="(industry, index) in industries"
            :key="industry.label"
            type="button"
            :class="
              cn(
                'relative flex cursor-pointer items-baseline text-left text-3xl font-light transition-colors outline-none md:text-4xl',
                index === activeIndex
                  ? 'text-primary-comfy-yellow'
                  : 'text-primary-comfy-canvas/60 hover:text-primary-comfy-canvas focus-visible:text-primary-comfy-canvas'
              )
            "
            :aria-current="index === activeIndex ? 'true' : undefined"
            @click="select(index)"
            @mouseenter="select(index)"
            @focus="select(index)"
          >
            {{ industry.label }}
          </button>
        </nav>

        <BrandButton :href="externalLinks.workflows" variant="outline">
          {{ t('industries.cta', locale) }}
        </BrandButton>
      </div>

      <!-- Node-shaped media cluster -->
      <div
        class="relative mx-auto aspect-[726.175/846.47] w-full max-w-xl lg:mx-0 lg:justify-self-end"
        aria-hidden="true"
      >
        <div class="absolute top-0 left-0 h-[73.64%] w-[47.356%]">
          <BlobMedia :src="active.primarySrc" :clip-id="primaryClipId" />
        </div>
        <div class="absolute top-[1.303%] right-0 h-[73.832%] w-[48.002%]">
          <BlobMedia
            :src="active.secondarySrc"
            :clip-id="secondaryClipId"
            :object-position="active.secondaryObjectPosition"
          />
        </div>
        <div
          class="absolute top-[67.649%] left-[13.149%] h-[32.351%] w-[79.832%]"
        >
          <BlobMedia :src="active.ambientSrc" :clip-id="ambientClipId" />
        </div>
      </div>
    </div>
  </section>
</template>
