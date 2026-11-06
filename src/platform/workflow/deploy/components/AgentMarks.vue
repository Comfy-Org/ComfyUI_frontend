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
        <stop stop-color="#B1A7FF" />
        <stop offset="0.5" stop-color="#7A9DFF" />
        <stop offset="1" stop-color="#3941FF" />
      </linearGradient>
    </defs>
    <g :mask="`url(#${cutoutId})`">
      <g transform="rotate(-10 10 10)">
        <circle cx="10" cy="10" r="10" fill="#fff" />
        <path
          transform="translate(2 2) scale(0.8421) translate(-2.5 -2.5)"
          :fill="`url(#${codexGradientId})`"
          :d="CODEX_MARK_PATH"
        />
      </g>
      <g transform="rotate(10 35 10)">
        <circle cx="35" cy="10" r="10" fill="#f1ecec" />
        <g transform="translate(28.6 2) scale(0.05) translate(-128 -96)">
          <path fill="#cfcecd" d="M320 224V352H192V224H320Z" />
          <path
            fill="#211e1e"
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
          />
        </g>
      </g>
    </g>
    <circle cx="22.5" cy="6.25" r="10" fill="#d97757" />
    <path
      transform="translate(14.5 -1.75) scale(0.6667)"
      fill="#fff"
      fill-rule="evenodd"
      clip-rule="evenodd"
      :d="CLAUDE_MARK_PATH"
    />
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import {
  CLAUDE_MARK_PATH,
  CODEX_MARK_PATH
} from '@/platform/workflow/deploy/components/agentMarkPaths'

const cutoutId = useId()
const codexGradientId = useId()
</script>
