<template>
  <svg
    viewBox="0 0 560 240"
    role="img"
    :aria-label="
      name.trim()
        ? $t('customNodePacks.thumbnail', { name })
        : $t('g.defaultBanner')
    "
    :class="['block aspect-7/3 w-full text-white', artwork.palette]"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="1" x2="1" y2="0">
        <stop stop-color="var(--thumbnail-base)" />
        <stop offset="1" stop-color="var(--thumbnail-accent)" />
      </linearGradient>
      <radialGradient :id="glowId">
        <stop stop-color="var(--thumbnail-glow)" stop-opacity="0.3" />
        <stop offset="1" stop-color="var(--thumbnail-glow)" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="560" height="240" fill="var(--thumbnail-base)" />
    <rect
      v-if="artwork.background === 'gradient'"
      width="560"
      height="240"
      :fill="`url(#${gradientId})`"
      opacity="0.65"
    />
    <ellipse cx="470" cy="45" rx="260" ry="240" :fill="`url(#${glowId})`" />
    <g
      fill="none"
      stroke="var(--thumbnail-glow)"
      stroke-width="2"
      opacity="0.16"
    >
      <g v-if="artwork.motif === 'rings'">
        <circle
          v-for="radius in [80, 125, 170]"
          :key="radius"
          cx="490"
          cy="190"
          :r="radius"
        />
      </g>
      <g v-else-if="artwork.motif === 'tiles'" transform="rotate(-18 470 120)">
        <rect
          v-for="size in [120, 190, 260]"
          :key="size"
          :x="470 - size / 2"
          :y="120 - size / 2"
          :width="size"
          :height="size"
          rx="24"
        />
      </g>
      <path
        v-else
        d="M320 -40 80 280 M420 -40 180 280 M520 -40 280 280 M620 -40 380 280"
      />
    </g>
    <path
      d="M162 120H230L260 90H326M230 120L260 150H300"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      opacity="0.18"
    />
    <g fill="var(--thumbnail-glow)" opacity="0.5">
      <circle cx="326" cy="90" r="4" />
      <circle cx="300" cy="150" r="4" />
    </g>
    <rect
      x="50"
      y="64"
      width="112"
      height="112"
      rx="28"
      fill="var(--thumbnail-base)"
      fill-opacity="0.65"
    />
    <rect
      x="50"
      y="64"
      width="112"
      height="112"
      rx="28"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.22"
    />
    <g transform="translate(76 90)" aria-hidden="true">
      <i-lucide:audio-lines
        v-if="artwork.icon === 'audio'"
        width="60"
        height="60"
      />
      <i-lucide:image
        v-else-if="artwork.icon === 'image'"
        width="60"
        height="60"
      />
      <i-lucide:layers
        v-else-if="artwork.icon === 'layers'"
        width="60"
        height="60"
      />
      <i-lucide:palette
        v-else-if="artwork.icon === 'palette'"
        width="60"
        height="60"
      />
      <i-lucide:type
        v-else-if="artwork.icon === 'text'"
        width="60"
        height="60"
      />
      <i-lucide:wrench
        v-else-if="artwork.icon === 'tools'"
        width="60"
        height="60"
      />
      <i-lucide:film
        v-else-if="artwork.icon === 'video'"
        width="60"
        height="60"
      />
      <i-lucide:network v-else width="60" height="60" />
    </g>
    <text
      x="256"
      y="143"
      fill="currentColor"
      font-family="var(--font-inter)"
      font-size="64"
      font-weight="700"
      letter-spacing="-2"
    >
      {{ artwork.monogram }}
    </text>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import { createNodePackThumbnail } from '@/platform/customNodes/utils/nodePackThumbnail'

const { name, identity } = defineProps<{
  name: string
  identity?: string
}>()

const artwork = computed(() => createNodePackThumbnail(identity || name, name))
const gradientId = `pack-gradient-${useId()}`
const glowId = `pack-glow-${useId()}`
</script>
