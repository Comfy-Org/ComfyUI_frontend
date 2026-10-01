<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useId } from 'vue'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { RelightScene } from '../../../lib/workshop/relight/lights'
import EditorTray from '../app-editor/EditorTray.vue'
import RelightSlider from './RelightSlider.vue'

const { scene, locale = 'en' } = defineProps<{
  scene: RelightScene
  locale?: Locale
}>()

const emit = defineEmits<{
  change: [patch: Partial<RelightScene>, key?: string]
  close: []
}>()

const promptId = useId()

function onPrompt(event: Event) {
  if (event.target instanceof HTMLInputElement)
    emit('change', { prompt: event.target.value }, 'prompt')
}
</script>

<template>
  <EditorTray
    :title="lc('relight.scene', locale)"
    :close-label="lc('relight.close', locale)"
    class="max-w-100"
    @close="emit('close')"
  >
    <div class="flex items-center justify-between gap-3 px-1">
      <span class="text-xs text-primary-warm-gray">{{
        lc('relight.scene.castShadows', locale)
      }}</span>
      <button
        type="button"
        role="switch"
        :aria-checked="scene.shadows"
        :aria-label="lc('relight.scene.castShadows', locale)"
        :class="
          cn(
            'flex h-5 w-9 items-center rounded-full p-0.5 transition focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
            scene.shadows
              ? 'justify-end bg-primary-comfy-yellow'
              : 'justify-start bg-transparency-white-t20'
          )
        "
        @click="emit('change', { shadows: !scene.shadows })"
      >
        <span class="size-4 rounded-full bg-primary-comfy-ink" />
      </button>
    </div>
    <RelightSlider
      :model-value="scene.ambient"
      :label="lc('relight.scene.ambient', locale)"
      @update:model-value="(ambient) => emit('change', { ambient }, 'ambient')"
    />
    <RelightSlider
      :model-value="scene.removeOriginal"
      :label="lc('relight.scene.removeOriginal', locale)"
      @update:model-value="
        (removeOriginal) => emit('change', { removeOriginal }, 'removeOriginal')
      "
    />
    <label :for="promptId" class="px-1 text-xs text-primary-warm-gray">{{
      lc('relight.scene.prompt', locale)
    }}</label>
    <input
      :id="promptId"
      :value="scene.prompt"
      type="text"
      :placeholder="lc('relight.scene.promptPlaceholder', locale)"
      class="h-8 rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-2.5 text-xs text-primary-warm-white placeholder:text-primary-warm-gray/60 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      @input="onPrompt"
    />
  </EditorTray>
</template>
