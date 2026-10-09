<script setup lang="ts">
import { Dices } from '@lucide/vue'
import { useId } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import { brc } from '@/lib/workshop/background-removal/copy'
import EditorIconButton from '@/components/workshop/app-editor/EditorIconButton.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const id = useId()

function setSeed(seed: number) {
  cutout.updateReplace({ seed }, 'seed')
}

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const next = Math.round(Number(event.target.value))
  if (Number.isFinite(next) && next >= 0) setSeed(next)
  else event.target.value = String(setup.value.replace.seed)
}
</script>

<template>
  <div
    class="flex h-10 items-center gap-2 rounded-xl border border-transparency-white-t8 pr-1 pl-3 hover:border-transparency-white-t20"
  >
    <label :for="id" class="text-sm text-primary-warm-gray">
      {{ brc('cutout.seed', locale) }}
    </label>
    <input
      :id
      :value="setup.replace.seed"
      type="number"
      min="0"
      step="1"
      class="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-primary-warm-white tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 disabled:opacity-40"
      @change="onChange"
    />
    <EditorIconButton
      :icon="Dices"
      :label="brc('cutout.seed.shuffle', locale)"
      @click="setSeed(Math.floor(Math.random() * 1_000_000_000))"
    />
  </div>
</template>
