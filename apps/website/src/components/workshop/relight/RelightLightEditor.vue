<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import RelightKind from './RelightKind.vue'
import RelightSlider from './RelightSlider.vue'
import RelightSwatches from './RelightSwatches.vue'

const { light, locale = 'en' } = defineProps<{
  light: Light
  locale?: Locale
}>()

const emit = defineEmits<{ change: [patch: Partial<Light>, key?: string] }>()
</script>

<template>
  <div
    class="flex flex-col gap-2.5 border-t border-transparency-white-t8 px-1 pt-2.5"
  >
    <RelightSlider
      :model-value="light.brightness"
      :label="lc('relight.brightness', locale)"
      @update:model-value="
        (brightness) => emit('change', { brightness }, `brightness:${light.id}`)
      "
    />
    <RelightSlider
      :model-value="light.softness"
      :label="lc('relight.softness', locale)"
      @update:model-value="
        (softness) => emit('change', { softness }, `softness:${light.id}`)
      "
    />
    <RelightSwatches
      :model-value="light.color"
      :locale
      @update:model-value="(color) => emit('change', { color })"
    />
    <RelightKind
      :model-value="light.kind"
      :locale
      @update:model-value="(kind) => emit('change', { kind })"
    />
  </div>
</template>
