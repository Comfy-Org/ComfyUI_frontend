<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { RunScene } from '../../lib/hub/run-scenes'
import { RUN_SCENES } from '../../lib/hub/run-scenes'

// A way to stand each state up on the page it belongs to rather than on a
// sheet beside it. Most of them cost credits or cannot be reached on purpose,
// so the only way to see one in place is to hand the panel the state.
const scene = defineModel<RunScene>()

const scenes = RUN_SCENES
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-2xl border border-dashed border-transparency-white-t20 p-3"
    data-testid="workflow-run-states"
  >
    <p
      class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
    >
      Preview a state
    </p>
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        :class="
          cn(
            'cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors',
            scene
              ? 'border-transparency-white-t20 text-primary-warm-gray hover:text-primary-warm-white'
              : 'border-primary-comfy-yellow text-primary-comfy-yellow'
          )
        "
        data-testid="workflow-run-states-live"
        @click="scene = undefined"
      >
        Live
      </button>
      <button
        v-for="option in scenes"
        :key="option.name"
        type="button"
        :class="
          cn(
            'cursor-pointer rounded-lg border px-2 py-1 text-xs transition-colors',
            scene?.name === option.name
              ? 'border-primary-comfy-yellow text-primary-comfy-yellow'
              : 'border-transparency-white-t20 text-primary-warm-gray hover:text-primary-warm-white'
          )
        "
        @click="scene = option"
      >
        {{ option.name }}
      </button>
    </div>
  </div>
</template>
