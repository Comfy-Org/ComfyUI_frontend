<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    overflow="visible"
    class="shrink-0"
    aria-hidden="true"
  >
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
    <template v-else-if="agent === 'codex'">
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
    <template v-else-if="agent === 'opencode'">
      <circle cx="10" cy="10" r="10" fill="#f1ecec" />
      <g transform="translate(3.6 2) scale(0.05) translate(-128 -96)">
        <path fill="#cfcecd" d="M320 224V352H192V224H320Z" />
        <path
          fill="#211e1e"
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
        />
      </g>
    </template>
    <template v-else>
      <circle cx="10" cy="10" r="10" class="fill-background" />
      <path
        transform="translate(10 10) scale(0.55) translate(-12 -12)"
        fill="none"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="stroke-foreground"
        :d="ASTROID_PATH"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

import {
  ASTROID_PATH,
  CLAUDE_MARK_PATH,
  CODEX_GRADIENT_STOPS,
  CODEX_MARK_PATH
} from '@/platform/workflow/deploy/components/agentMarkPaths'
import type { AgentMarkName } from '@/platform/workflow/deploy/components/agentMarkPaths'

const { size = 16 } = defineProps<{
  agent: AgentMarkName
  size?: number
}>()

const codexGradientId = useId()
</script>
