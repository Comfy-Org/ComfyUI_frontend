<template>
  <svg
    :width="stack.width"
    height="28"
    :viewBox="`0 -4 ${stack.width} 28`"
    class="shrink-0"
    aria-hidden="true"
    :data-testid="`agent-marks-${marks}`"
  >
    <defs>
      <mask
        :id="cutoutId"
        maskUnits="userSpaceOnUse"
        x="0"
        y="-4"
        :width="stack.width"
        height="28"
      >
        <rect x="0" y="-4" :width="stack.width" height="28" fill="#fff" />
        <circle
          :cx="stack.front.x + MARK_RADIUS"
          :cy="stack.front.y + MARK_RADIUS"
          :r="MARK_RADIUS + 2"
          fill="#000"
        />
      </mask>
    </defs>
    <g :mask="`url(#${cutoutId})`">
      <g
        v-for="placed in stack.behind"
        :key="placed.agent"
        :transform="tilt(placed)"
      >
        <AgentMark v-bind="placement(placed)" />
      </g>
    </g>
    <g :transform="tilt(stack.front)">
      <AgentMark v-bind="placement(stack.front)" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'
import type { AgentMarkName } from '@/platform/workflow/deploy/components/agentMarkPaths'

type AgentMarkStack = 'codingAgents' | 'localAgent' | 'desktopAgents'

interface PlacedMark {
  agent: AgentMarkName
  x: number
  y: number
  tilt: number
}

interface MarkStack {
  width: number
  behind: PlacedMark[]
  front: PlacedMark
}

const MARK_RADIUS = 10

const STACKS: Record<AgentMarkStack, MarkStack> = {
  codingAgents: {
    width: 45,
    behind: [
      { agent: 'codex', x: 0, y: 0, tilt: -10 },
      { agent: 'opencode', x: 25, y: 0, tilt: 10 }
    ],
    front: { agent: 'claude', x: 12.5, y: -3.75, tilt: 0 }
  },
  localAgent: {
    width: 45,
    behind: [
      { agent: 'claude', x: 0, y: 0, tilt: -10 },
      { agent: 'codex', x: 25, y: 0, tilt: 10 }
    ],
    front: { agent: 'localAgent', x: 12.5, y: -3.75, tilt: 0 }
  },
  desktopAgents: {
    width: 38,
    behind: [{ agent: 'codex', x: 18, y: 0, tilt: 10 }],
    front: { agent: 'claude', x: 0, y: 0, tilt: -10 }
  }
}

const { marks = 'codingAgents' } = defineProps<{
  marks?: AgentMarkStack
}>()

const stack = computed(() => STACKS[marks])
const cutoutId = useId()

function tilt({ x, y, tilt }: PlacedMark): string {
  return `rotate(${tilt} ${x + MARK_RADIUS} ${y + MARK_RADIUS})`
}

function placement({ agent, x, y }: PlacedMark) {
  return { agent, x, y, size: MARK_RADIUS * 2 }
}
</script>
