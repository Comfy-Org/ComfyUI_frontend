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
const drops = Array.from({ length: 5 }, (_, index) => {
  const duration = 2.8 + Math.random() * 2
  return {
    left: 5 + index * 18 + Math.random() * 10,
    size: 7 + Math.random() * 8,
    delay: -Math.random() * duration,
    duration
  }
})
</script>
