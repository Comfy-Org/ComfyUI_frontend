<template>
  <div
    aria-hidden="true"
    class="node-blood-drips pointer-events-none absolute inset-x-2 top-full -z-1 h-20"
    :style="{ filter: `url(#${filterId})` }"
  >
    <svg class="absolute size-0" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter :id="filterId" x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
    <span
      v-for="drop in drops"
      :key="drop.left"
      data-testid="node-blood-drop"
      class="node-blood-drop absolute -top-1 rounded-full bg-current"
      :style="{
        left: `${drop.left}%`,
        width: `${drop.size}px`,
        height: `${drop.size}px`,
        animationDelay: `${drop.delay}s`,
        animationDuration: `${drop.duration}s`
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

const filterId = `node-blood-${useId()}`
const drops = [
  { left: 9, size: 9, delay: -0.4, duration: 3.2 },
  { left: 31, size: 15, delay: -1.8, duration: 4.1 },
  { left: 48, size: 7, delay: -0.9, duration: 2.8 },
  { left: 72, size: 12, delay: -2.7, duration: 3.7 },
  { left: 89, size: 10, delay: -3.2, duration: 4.6 }
]
</script>
