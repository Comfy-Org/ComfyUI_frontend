<template>
  <svg
    width="38"
    height="28"
    viewBox="0 -4 38 28"
    class="shrink-0"
    aria-hidden="true"
  >
    <defs>
      <mask
        :id="cutoutId"
        maskUnits="userSpaceOnUse"
        x="0"
        y="-4"
        width="38"
        height="28"
      >
        <rect x="0" y="-4" width="38" height="28" fill="#fff" />
        <circle cx="10" cy="10" r="12" fill="#000" />
      </mask>
      <linearGradient
        :id="codexGradientId"
        gradientUnits="userSpaceOnUse"
        x1="12"
        x2="12"
        y1="3"
        y2="21"
      >
        <stop
          v-for="stop in CODEX_GRADIENT_STOPS"
          :key="stop.offset"
          :offset="stop.offset"
          :stop-color="stop.color"
        />
      </linearGradient>
    </defs>
    <g :mask="`url(#${cutoutId})`">
      <g transform="rotate(10 28 10)">
        <circle cx="28" cy="10" r="10" fill="#fff" />
        <path
          transform="translate(20 2) scale(0.8421) translate(-2.5 -2.5)"
          :fill="`url(#${codexGradientId})`"
          :d="CODEX_MARK_PATH"
        />
      </g>
    </g>
    <g transform="rotate(-10 10 10)">
      <circle cx="10" cy="10" r="10" fill="#d97757" />
      <path
        transform="translate(2 2) scale(0.6667)"
        fill="#fff"
        fill-rule="evenodd"
        clip-rule="evenodd"
        :d="CLAUDE_MARK_PATH"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import {
  CLAUDE_MARK_PATH,
  CODEX_GRADIENT_STOPS,
  CODEX_MARK_PATH
} from '@/platform/workflow/deploy/components/agentMarkPaths'

const cutoutId = useId()
const codexGradientId = useId()
</script>
