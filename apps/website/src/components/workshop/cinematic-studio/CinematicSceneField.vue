<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PromptSegment } from '../../../lib/workshop/cinematic-studio/prompt'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { promptSegments, locale = 'en' } = defineProps<{
  promptSegments: readonly PromptSegment[]
  locale?: Locale
}>()

const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })

const showFullPrompt = ref(false)
const labelClass =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const segmentClass: Record<PromptSegment['source'], string> = {
  scene: 'text-primary-warm-white',
  direction: 'text-primary-comfy-canvas',
  enhance: 'text-primary-warm-gray',
  reference: 'text-primary-warm-gray'
}
</script>

<template>
  <section class="flex flex-col gap-2.5 p-5">
    <div class="flex items-center justify-between">
      <label for="cinematic-scene" :class="labelClass">
        {{ tc('cinematic.section.scene', locale) }}
      </label>
      <button
        type="button"
        class="text-xs text-primary-comfy-canvas underline underline-offset-4 hover:text-primary-warm-white"
        :aria-pressed="showFullPrompt"
        @click="showFullPrompt = !showFullPrompt"
      >
        {{
          tc(
            showFullPrompt
              ? 'cinematic.scene.edit'
              : 'cinematic.scene.fullPrompt',
            locale
          )
        }}
      </button>
    </div>
    <div
      class="flex flex-col rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
    >
      <p
        v-if="showFullPrompt"
        class="h-28 overflow-y-auto px-3.5 pt-3 pb-2 text-sm leading-relaxed"
        data-testid="cinematic-full-prompt"
      >
        <span
          v-for="(segment, index) in promptSegments"
          :key="index"
          :class="cn('me-1', segmentClass[segment.source])"
          >{{ segment.text }}</span
        >
      </p>
      <textarea
        v-else
        id="cinematic-scene"
        v-model="scene"
        rows="4"
        :placeholder="tc('cinematic.scene.placeholder', locale)"
        class="h-28 resize-none bg-transparent px-3.5 pt-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
      />
      <label
        class="flex cursor-pointer items-center gap-2.5 border-t border-transparency-white-t8 px-3.5 py-2.5 text-xs text-primary-warm-white"
      >
        <input
          v-model="enhance"
          type="checkbox"
          role="switch"
          class="peer sr-only"
        />
        <span
          class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
          aria-hidden="true"
        />
        {{ tc('cinematic.scene.enhance', locale) }}
        <span class="truncate text-primary-warm-gray">
          {{ tc('cinematic.scene.enhanceHint', locale) }}
        </span>
      </label>
    </div>
  </section>
</template>
