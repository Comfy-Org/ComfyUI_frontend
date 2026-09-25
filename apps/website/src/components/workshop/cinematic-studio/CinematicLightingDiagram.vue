<script setup lang="ts">
import { computed } from 'vue'
import type { Locale } from '../../../i18n/translations'
import type { CreativeSettings } from '../../../lib/workshop/cinematic-studio/creative'
import { tcCreative } from '../../../lib/workshop/cinematic-studio/creative-copy'

const { lights, locale = 'en' } = defineProps<{
  lights: CreativeSettings['lights']
  locale?: Locale
}>()
const t = (key: Parameters<typeof tcCreative>[0]) => tcCreative(key, locale)
const positions = {
  front: [140, 190],
  back: [140, 60],
  left: [40, 126],
  right: [240, 126],
  top: [320, 60],
  bottom: [320, 190]
} as const
const markers = computed(() =>
  lights.map((light, index) => {
    const peers = lights
      .map((item, i) => (item.position === light.position ? i : -1))
      .filter((i) => i >= 0)
    const offset = (peers.indexOf(index) - (peers.length - 1) / 2) * 26
    const [x, y] = positions[light.position]
    const side = light.position === 'left' || light.position === 'right'
    return {
      ...light,
      number: index + 1,
      x: x + (side ? 0 : offset),
      y: y + (side ? offset : 0),
      target:
        light.position === 'top' || light.position === 'bottom' ? 320 : 140
    }
  })
)
const description = computed(() =>
  lights.length
    ? lights
        .map(
          (light, index) =>
            `${t('light')} ${index + 1}: ${t(light.position)}, ${light.color}, ${t('brightness')} ${light.brightness}%, ${t('diffusion')} ${light.diffusion}%`
        )
        .join('; ')
    : t('emptyLights')
)
</script>

<template>
  <figure
    class="rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink p-3"
  >
    <figcaption class="text-sm font-semibold">
      {{ t('lightLayout') }}
    </figcaption>
    <svg
      viewBox="0 0 360 280"
      role="img"
      :aria-label="t('lightLayout')"
      :aria-description="description"
      class="mx-auto w-full max-w-lg text-primary-comfy-canvas"
    >
      <g fill="none" stroke="currentColor" opacity="0.4">
        <circle cx="140" cy="126" r="72" stroke-dasharray="4 5" />
        <path
          d="M278 12V224 M320 79V108 M320 144V171 M140 210V232"
          stroke-dasharray="4 4"
        />
      </g>
      <g fill="currentColor" text-anchor="middle" font-size="12">
        <text x="140" y="18">{{ t('planView') }}</text>
        <text x="320" y="18">{{ t('elevationView') }}</text>
        <text x="140" y="38">{{ t('back') }}</text>
        <text x="40" y="82">{{ t('left') }}</text>
        <text x="240" y="82">{{ t('right') }}</text>
        <text x="140" y="215">{{ t('front') }}</text>
        <text x="320" y="38">{{ t('top') }}</text>
        <text x="320" y="215">{{ t('bottom') }}</text>
        <text x="140" y="160">{{ t('subject') }}</text>
        <text x="320" y="160">{{ t('subject') }}</text>
        <text x="140" y="270">{{ t('camera') }}</text>
      </g>
      <g v-for="marker in markers" :key="marker.number">
        <line
          :x1="marker.x"
          :y1="marker.y"
          :x2="marker.target"
          y2="126"
          :stroke="marker.color"
          stroke-dasharray="3 4"
          opacity="0.6"
        />
        <circle
          :cx="marker.x"
          :cy="marker.y"
          r="11"
          :stroke="marker.color"
          stroke-width="3"
          class="fill-primary-comfy-ink"
        />
        <text
          :x="marker.x"
          :y="marker.y + 4"
          text-anchor="middle"
          font-size="12"
          font-weight="600"
          class="fill-primary-warm-white"
        >
          {{ marker.number }}
        </text>
      </g>
      <g fill="currentColor" class="text-primary-warm-white">
        <circle cx="140" cy="118" r="8" />
        <path d="M126 142a14 14 0 0 1 28 0Z" />
        <circle cx="320" cy="118" r="8" />
        <path d="M306 142a14 14 0 0 1 28 0Z" />
        <rect x="125" y="237" width="24" height="16" rx="3" />
        <path d="M149 242l9-5v16l-9-5Z" />
      </g>
    </svg>
    <ul
      v-if="lights.length"
      class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-primary-comfy-canvas"
    >
      <li
        v-for="(light, index) in lights"
        :key="index"
        class="flex items-center gap-2"
      >
        <span
          aria-hidden="true"
          class="size-3 rounded-full border border-transparency-white-t20"
          :style="{ backgroundColor: light.color }"
        />
        {{ t('light') }} {{ index + 1 }} · {{ t(light.position) }} ·
        {{ light.brightness }}%
      </li>
    </ul>
    <p v-else class="text-xs text-primary-comfy-canvas">
      {{ t('emptyLights') }}
    </p>
    <p class="mt-3 text-xs/relaxed text-primary-comfy-canvas">
      {{ t('diagramNote') }}
    </p>
  </figure>
</template>
