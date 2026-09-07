<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useId } from 'vue'

defineProps<{ class?: HTMLAttributes['class'] }>()

const clipId = `node-union-icon-clip-${useId()}`
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    aria-hidden="true"
    :class="$props.class"
  >
    <g :clip-path="`url(#${clipId})`">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M-1.59144e-05 0H100V100H-1.59144e-05V0ZM32.3741 50C32.3741 77.0727 16.2692 99.0196 -3.59714 99.0196C-23.4635 99.0196 -39.5684 77.0727 -39.5684 50C-39.5684 22.9273 -23.4635 0.980392 -3.59714 0.980392C16.2692 0.980392 32.3741 22.9273 32.3741 50ZM139.568 50C139.568 77.0727 123.463 99.0196 103.597 99.0196C83.7309 99.0196 67.6259 77.0727 67.6259 50C67.6259 22.9273 83.7309 0.980392 103.597 0.980392C123.463 0.980392 139.568 22.9273 139.568 50Z"
      />
    </g>
    <defs>
      <clipPath :id="clipId">
        <rect width="100" height="100" fill="white" />
      </clipPath>
    </defs>
  </svg>
</template>
