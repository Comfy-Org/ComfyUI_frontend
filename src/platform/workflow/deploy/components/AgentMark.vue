<template>
  <svg viewBox="0 0 20 20" class="size-4 shrink-0" aria-hidden="true">
    <template v-if="agent === 'claude'">
      <circle cx="10" cy="10" r="10" fill="#d97757" />
      <path
        transform="translate(2 2) scale(0.6667)"
        fill="#fff"
        fill-rule="evenodd"
        clip-rule="evenodd"
        :d="CLAUDE_MARK_PATH"
      />
    </template>
    <template v-else>
      <defs>
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
      <circle cx="10" cy="10" r="10" fill="#fff" />
      <path
        transform="translate(2 2) scale(0.8421) translate(-2.5 -2.5)"
        :fill="`url(#${codexGradientId})`"
        :d="CODEX_MARK_PATH"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import {
  CLAUDE_MARK_PATH,
  CODEX_GRADIENT_STOPS,
  CODEX_MARK_PATH
} from '@/platform/workflow/deploy/components/agentMarkPaths'

const { agent } = defineProps<{
  agent: 'claude' | 'codex'
}>()

const codexGradientId = useId()
</script>
