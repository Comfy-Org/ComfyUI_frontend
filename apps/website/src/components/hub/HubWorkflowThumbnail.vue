<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { resolveTemplateLogos } from '@/lib/hub/model-logos'
import type { HubTemplate } from '@/lib/hub/types'
import type { Locale } from '@/i18n/translations'
import HubTypeBadge from './HubTypeBadge.vue'

const { template, href, locale, showTypeBadge, providerBadgeAtTop } =
  defineProps<{
    template: HubTemplate
    href: string
    locale: Locale
    showTypeBadge: boolean
    providerBadgeAtTop: boolean
  }>()

const modelLogos = computed(() =>
  resolveTemplateLogos({
    logos: template.logos,
    models: template.models
  })
)
// A workflow can run half a dozen models, and a row of logos in a corner reads
// as noise, so the badge shows the first and names the rest on hover.
const firstLogo = computed(() => modelLogos.value[0])
const SHOWN_LOGOS = 3
const shownLogos = computed(() => modelLogos.value.slice(0, SHOWN_LOGOS))
const modelNames = computed(() =>
  modelLogos.value.map((logo) => logo.name).join(', ')
)
const primaryUrl = computed(() => template.thumbnails[0] ?? null)
const secondaryUrl = computed(() => template.thumbnails[1] ?? null)
const showCompare = computed(
  () =>
    template.thumbnailVariant === 'compareSlider' &&
    Boolean(primaryUrl.value && secondaryUrl.value)
)
const showHoverDissolve = computed(
  () =>
    template.thumbnailVariant === 'hoverDissolve' &&
    Boolean(primaryUrl.value && secondaryUrl.value)
)
const showZoomHover = computed(
  () =>
    (template.thumbnailVariant === 'zoomHover' ||
      template.thumbnailVariant === 'hoverZoom') &&
    Boolean(primaryUrl.value)
)

const compareRoot = ref<HTMLElement | null>(null)
const comparePosition = ref(50)

function onCompareMove(event: PointerEvent) {
  const el = compareRoot.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  comparePosition.value = Math.min(
    100,
    Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)
  )
}

function onCompareKeydown(event: KeyboardEvent) {
  let nextPosition: number
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      nextPosition = comparePosition.value - 1
      break
    case 'ArrowRight':
    case 'ArrowUp':
      nextPosition = comparePosition.value + 1
      break
    case 'Home':
      nextPosition = 0
      break
    case 'End':
      nextPosition = 100
      break
    default:
      return
  }
  event.preventDefault()
  comparePosition.value = Math.min(100, Math.max(0, nextPosition))
}

onMounted(() =>
  compareRoot.value?.addEventListener('pointermove', onCompareMove)
)
onUnmounted(() =>
  compareRoot.value?.removeEventListener('pointermove', onCompareMove)
)

const linkAttributes = computed(() => {
  if (href.startsWith('http')) return { target: '_blank', rel: 'noopener' }
  return {}
})
const primaryImage = computed(() => primaryUrl.value ?? '')
const secondaryImage = computed(() => secondaryUrl.value ?? '')
const imageClasses = computed(() =>
  cn(
    'size-full object-cover transition-transform select-none',
    showZoomHover.value
      ? 'duration-500 group-hover:scale-125'
      : 'duration-300 group-hover:scale-105'
  )
)
const titleClasses = computed(() =>
  cn(
    'pointer-events-none absolute bottom-5 left-5 z-10 line-clamp-2 text-sm/[1.35] font-medium text-content-bright drop-shadow-md lg:text-base',
    modelLogos.value.length > 1 ? 'right-28' : 'right-16'
  )
)
const badgeClasses = computed(() =>
  cn(
    'pointer-events-none absolute right-5 z-10 flex flex-col items-end text-white drop-shadow-md',
    providerBadgeAtTop
      ? 'top-5 rounded-xl bg-black/30 p-2 backdrop-blur-sm'
      : 'bottom-5'
  )
)
</script>

<template>
  <div class="relative aspect-4/3 overflow-hidden rounded-3.5xl bg-hub-surface">
    <HubTypeBadge
      v-if="showTypeBadge"
      :kind="template.isApp ? 'comfyApp' : 'nodeGraph'"
      :locale
    />
    <div
      v-if="showCompare"
      ref="compareRoot"
      class="relative size-full overflow-hidden"
    >
      <img
        :src="primaryImage"
        :alt="`${template.title} - After`"
        loading="lazy"
        decoding="async"
        draggable="false"
        class="size-full object-cover select-none"
      />
      <div
        class="absolute inset-0 overflow-hidden"
        :style="{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }"
      >
        <img
          :src="secondaryImage"
          :alt="`${template.title} - Before`"
          loading="lazy"
          decoding="async"
          draggable="false"
          class="size-full object-cover select-none"
        />
      </div>
      <div
        class="absolute inset-y-0 w-1 cursor-ew-resize bg-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow"
        :style="{ left: `${comparePosition}%` }"
        role="slider"
        tabindex="0"
        :aria-label="`${template.title} image comparison`"
        aria-orientation="horizontal"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(comparePosition)"
        :aria-valuetext="`${Math.round(comparePosition)}%`"
        @click.stop
        @keydown="onCompareKeydown"
      />
    </div>
    <div
      v-else-if="showHoverDissolve"
      class="group/thumb relative size-full overflow-hidden"
    >
      <img
        :src="primaryImage"
        :alt="`${template.title} - 1`"
        loading="lazy"
        decoding="async"
        draggable="false"
        class="size-full object-cover transition-opacity duration-500 select-none"
      />
      <img
        :src="secondaryImage"
        :alt="`${template.title} - 2`"
        loading="lazy"
        decoding="async"
        draggable="false"
        class="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 select-none group-hover/thumb:opacity-100"
      />
    </div>
    <img
      v-else-if="primaryUrl"
      :src="primaryUrl"
      :alt="template.title"
      loading="lazy"
      decoding="async"
      draggable="false"
      :class="imageClasses"
    />
    <div
      v-else
      class="flex size-full items-center justify-center bg-linear-to-br from-white/5 to-white/10"
    >
      <svg
        class="size-10 text-content/20"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
        />
      </svg>
    </div>

    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/70 via-black/30 to-transparent"
      aria-hidden="true"
    />
    <h3 :class="titleClasses">
      <a
        :href="href"
        v-bind="linkAttributes"
        class="pointer-events-auto"
        data-testid="hub-card-link"
        @click.stop
      >
        {{ template.title }}
      </a>
    </h3>
    <!-- The marks say which models the workflow runs, and their names are
        a tooltip away; spelled out on the card they crossed the title. -->
    <span
      v-if="firstLogo"
      :class="badgeClasses"
      :title="modelNames"
      data-testid="hub-card-models"
    >
      <span class="flex items-center gap-1.5">
        <span
          v-for="logo in shownLogos"
          :key="logo.name"
          class="size-5 shrink-0 bg-white mask-contain mask-center mask-no-repeat"
          :style="{ maskImage: `url(${logo.src})` }"
        />
        <span
          v-if="modelLogos.length > SHOWN_LOGOS"
          class="text-xs font-bold tabular-nums"
        >
          +{{ modelLogos.length - SHOWN_LOGOS }}
        </span>
      </span>
    </span>
  </div>
</template>
