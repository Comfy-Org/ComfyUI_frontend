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
      v-for="drop in 5"
      :key="drop"
      data-testid="node-blood-drop"
      class="node-blood-drop absolute -top-1 size-3 rounded-full bg-current"
      :style="{
        left: `${8 + (drop - 1) * 20}%`,
        animationDelay: `${-drop * 0.73}s`
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

const filterId = `node-blood-${useId()}`
</script>
