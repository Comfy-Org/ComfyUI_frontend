<script setup lang="ts">
// Abstract build visual: three loose sources (nodes, models, pinned deps)
// flow into one sealed, immutable build — which fans out to its deploy
// targets. All geometry, no labels.
const sources = [
  { y: 60, dots: 3 },
  { y: 140, dots: 2 },
  { y: 220, dots: 4 }
]

const targets = [{ y: 90 }, { y: 190 }]
</script>

<template>
  <div
    aria-hidden="true"
    class="flex h-full min-h-72 items-center overflow-hidden rounded-3xl bg-black/40 p-6 lg:p-8"
  >
    <svg viewBox="0 0 480 280" class="h-full w-full">
      <!-- Sources: loose parts, flowing inward -->
      <g v-for="source in sources" :key="source.y">
        <rect
          x="24"
          :y="source.y - 16"
          width="72"
          height="32"
          rx="10"
          class="fill-white/5 stroke-primary-comfy-canvas/40"
        />
        <circle
          v-for="dot in source.dots"
          :key="dot"
          :cx="40 + (dot - 1) * 14"
          :cy="source.y"
          r="4"
          class="fill-primary-comfy-canvas/70"
        />
        <path
          :d="`M 100 ${source.y} C 160 ${source.y}, 180 140, 216 140`"
          class="animate-dash-flow fill-none stroke-primary-comfy-canvas/40"
          stroke-width="1.5"
          stroke-dasharray="6 6"
        />
      </g>

      <!-- The immutable build: a sealed isometric cube -->
      <g class="stroke-primary-comfy-yellow" stroke-width="2">
        <polygon
          points="240,96 280,118 240,140 200,118"
          class="fill-primary-comfy-yellow/20"
        />
        <polygon
          points="200,118 240,140 240,186 200,164"
          class="fill-primary-comfy-yellow/10"
        />
        <polygon
          points="280,118 240,140 240,186 280,164"
          class="fill-primary-comfy-yellow/5"
        />
      </g>
      <circle
        cx="240"
        cy="140"
        r="52"
        class="animate-ripple fill-none stroke-primary-comfy-yellow/40"
      />

      <!-- Deploy targets: the same build, anywhere -->
      <g v-for="target in targets" :key="target.y">
        <path
          :d="`M 264 140 C 320 140, 330 ${target.y}, 368 ${target.y}`"
          class="animate-dash-flow fill-none stroke-primary-comfy-yellow/50"
          stroke-width="1.5"
          stroke-dasharray="6 6"
        />
        <rect
          x="368"
          :y="target.y - 20"
          width="88"
          height="40"
          rx="12"
          class="fill-primary-comfy-yellow/10 stroke-primary-comfy-yellow/60"
        />
        <polygon
          :points="`412,${target.y - 9} 424,${target.y} 412,${target.y + 9} 400,${target.y}`"
          class="fill-primary-comfy-yellow/40 stroke-primary-comfy-yellow/80"
        />
      </g>
    </svg>
  </div>
</template>
