<template>
  <div class="flex size-full bg-base-background">
    <div class="relative flex-1">
      <div
        ref="containerRef"
        class="absolute size-full"
        data-testid="hdr-viewer-canvas"
      />

      <div
        v-if="viewer.loading.value"
        class="absolute inset-0 flex items-center justify-center text-base-foreground"
      >
        {{ $t('g.loading') }}...
      </div>
      <div
        v-else-if="viewer.error.value"
        role="alert"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-base-foreground"
      >
        <i class="icon-[lucide--image-off] size-12" />
        <p class="text-sm">{{ $t('hdrViewer.failedToLoad') }}</p>
      </div>

      <div
        v-if="viewer.pixel.value"
        class="absolute top-2 left-2 rounded-sm bg-base-background/80 px-2 py-1 font-mono text-xs text-base-foreground"
        data-testid="hdr-pixel-readout"
      >
        <div>{{ viewer.pixel.value.x }}, {{ viewer.pixel.value.y }}</div>
        <div>
          {{ formatNum(viewer.pixel.value.r) }}
          {{ formatNum(viewer.pixel.value.g) }}
          {{ formatNum(viewer.pixel.value.b) }}
          <template v-if="viewer.pixel.value.a !== null">
            {{ formatNum(viewer.pixel.value.a) }}
          </template>
        </div>
      </div>
    </div>

    <div class="flex w-72 flex-col" data-testid="hdr-viewer-sidebar">
      <div class="flex-1 overflow-y-auto p-4">
        <div class="space-y-2">
          <div class="space-y-4 p-2">
            <div class="flex flex-col gap-2">
              <label>{{ $t('hdrViewer.exposure') }}: {{ exposureLabel }}</label>
              <input
                v-model.number="viewer.exposureStops.value"
                type="range"
                min="-10"
                max="10"
                step="0.1"
                class="w-full"
                :aria-label="$t('hdrViewer.exposure')"
              />
            </div>
            <Button
              variant="secondary"
              class="w-full"
              @click="viewer.normalizeExposure"
            >
              {{ $t('hdrViewer.normalizeExposure') }}
            </Button>
          </div>

          <div class="space-y-4 p-2">
            <div class="flex flex-col gap-2">
              <label>{{ $t('hdrViewer.channel') }}</label>
              <select
                v-model="viewer.channel.value"
                class="bg-base-component-surface w-full rounded-sm px-2 py-1"
                :aria-label="$t('hdrViewer.channel')"
              >
                <option v-for="mode in channelModes" :key="mode" :value="mode">
                  {{ channelLabels[mode] }}
                </option>
              </select>
            </div>

            <div class="flex flex-col gap-2">
              <label>{{ $t('hdrViewer.sourceGamut') }}</label>
              <select
                v-model="viewer.gamut.value"
                class="bg-base-component-surface w-full rounded-sm px-2 py-1"
                :aria-label="$t('hdrViewer.sourceGamut')"
              >
                <option v-for="name in gamutNames" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
            </div>
          </div>

          <div class="space-y-4 p-2">
            <div class="flex items-center gap-2">
              <input
                id="hdr-dither"
                v-model="viewer.dither.value"
                type="checkbox"
                class="size-4 cursor-pointer accent-node-component-surface-highlight"
              />
              <label for="hdr-dither" class="cursor-pointer">
                {{ $t('hdrViewer.dither') }}
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                id="hdr-clip"
                v-model="viewer.clipWarnings.value"
                type="checkbox"
                class="size-4 cursor-pointer accent-node-component-surface-highlight"
              />
              <label for="hdr-clip" class="cursor-pointer">
                {{ $t('hdrViewer.clipWarnings') }}
              </label>
            </div>
          </div>

          <div v-if="histogramPath" class="space-y-2 p-2">
            <label>{{ $t('hdrViewer.histogram') }}</label>
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              class="bg-base-component-surface aspect-3/2 w-full rounded-sm"
            >
              <path
                :d="histogramPath"
                :class="histogramColorClass"
                fill="currentColor"
                fill-opacity="0.5"
                stroke="none"
              />
            </svg>
          </div>

          <div
            v-if="viewer.stats.value"
            class="space-y-1 p-2 text-xs tabular-nums"
          >
            <div v-if="viewer.dimensions.value" class="flex justify-between">
              <span>{{ $t('hdrViewer.resolution') }}</span>
              <span>{{ viewer.dimensions.value }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('hdrViewer.min') }}</span>
              <span>{{ formatNum(viewer.stats.value.min) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('hdrViewer.max') }}</span>
              <span>{{ formatNum(viewer.stats.value.max) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('hdrViewer.mean') }}</span>
              <span>{{ formatNum(viewer.stats.value.mean) }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ $t('hdrViewer.stdDev') }}</span>
              <span>{{ formatNum(viewer.stats.value.stdDev) }}</span>
            </div>
            <div
              v-if="viewer.stats.value.nanCount"
              class="flex justify-between text-error"
            >
              <span>{{ $t('hdrViewer.nan') }}</span>
              <span>{{ viewer.stats.value.nanCount }}</span>
            </div>
            <div
              v-if="viewer.stats.value.infCount"
              class="flex justify-between text-error"
            >
              <span>{{ $t('hdrViewer.inf') }}</span>
              <span>{{ viewer.stats.value.infCount }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4">
        <div class="flex gap-2">
          <Button variant="secondary" class="flex-1" @click="viewer.fitView">
            {{ $t('hdrViewer.fitView') }}
          </Button>
          <Button variant="secondary" class="flex-1" @click="handleDownload">
            {{ $t('g.downloadImage') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { downloadFile } from '@/base/common/downloadUtil'
import Button from '@/components/ui/button/Button.vue'
import type { ChannelMode } from '@/composables/useHdrViewer'
import { CHANNEL_MODES, useHdrViewer } from '@/composables/useHdrViewer'
import { GAMUT_NAMES } from '@/renderer/hdr/colorGamut'
import { toFullResolutionUrl } from '@/utils/hdrFormatUtil'
import { histogramToPath } from '@/utils/histogramUtil'

const { imageUrl } = defineProps<{ imageUrl: string }>()

const { t } = useI18n()
const viewer = useHdrViewer()
const gamutNames = GAMUT_NAMES
const channelModes = CHANNEL_MODES
const containerRef = useTemplateRef<HTMLDivElement>('containerRef')

const exposureLabel = computed(() => {
  const value = viewer.exposureStops.value
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
})

const histogramPath = computed(() =>
  viewer.histogram.value ? histogramToPath(viewer.histogram.value) : ''
)

const histogramColorClass = computed(() => {
  switch (viewer.channel.value) {
    case 'r':
      return 'text-red-500'
    case 'g':
      return 'text-green-500'
    case 'b':
      return 'text-blue-500'
    default:
      return 'text-base-foreground'
  }
})

const channelLabels = computed<Record<ChannelMode, string>>(() => ({
  rgb: t('hdrViewer.channels.rgb'),
  r: t('hdrViewer.channels.r'),
  g: t('hdrViewer.channels.g'),
  b: t('hdrViewer.channels.b'),
  a: t('hdrViewer.channels.a'),
  luminance: t('hdrViewer.channels.luminance')
}))

function formatNum(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  return Math.abs(value) >= 1000 || (value !== 0 && Math.abs(value) < 0.001)
    ? value.toExponential(3)
    : value.toFixed(4)
}

function handleDownload() {
  downloadFile(toFullResolutionUrl(imageUrl))
}

onMounted(() => {
  if (containerRef.value) void viewer.mount(containerRef.value, imageUrl)
})
</script>
