<template>
  <svg
    width="45"
    height="28"
    viewBox="0 -4 45 28"
    class="shrink-0"
    aria-hidden="true"
  >
    <defs>
      <mask
        :id="cutoutId"
        maskUnits="userSpaceOnUse"
        x="0"
        y="-4"
        width="45"
        height="28"
      >
        <rect x="0" y="-4" width="45" height="28" fill="#fff" />
        <circle cx="22.5" cy="6.25" r="12" fill="#000" />
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
      <g transform="rotate(10 35 10)">
        <circle cx="35" cy="10" r="10" fill="#fff" />
        <path
          transform="translate(27 2) scale(0.8421) translate(-2.5 -2.5)"
          :fill="`url(#${codexGradientId})`"
          :d="CODEX_MARK_PATH"
        />
      </g>
    </g>
    <circle cx="22.5" cy="6.25" r="10" class="fill-background" />
    <path
      transform="translate(22.5 6.25) scale(0.55) translate(-12 -12)"
      fill="none"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="stroke-foreground"
      :d="ASTROID_PATH"
    />
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import {
  CLAUDE_MARK_PATH,
  CODEX_GRADIENT_STOPS,
  CODEX_MARK_PATH
} from '@/platform/workflow/deploy/components/agentMarkPaths'

const ASTROID_PATH =
  'M12.983 21.186a1 1 0 0 1-1.966 0a10 10 0 0 0-8.203-8.203a1 1 0 0 1 0-1.966a10 10 0 0 0 8.203-8.203a1 1 0 0 1 1.966 0a10 10 0 0 0 8.203 8.203a1 1 0 0 1 0 1.966a10 10 0 0 0-8.203 8.203'

const cutoutId = useId()
const codexGradientId = useId()
</script>
