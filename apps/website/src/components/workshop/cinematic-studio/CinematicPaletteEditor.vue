<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicColors from './CinematicColors.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const emit = defineEmits<{ done: [] }>()

const colors = defineModel<readonly string[]>('colors', { required: true })
const main = defineModel<number | undefined>('main')
</script>

<template>
  <CinematicColors v-model="colors" v-model:main="main" :locale>
    <button
      type="button"
      class="h-10 w-full rounded-xl bg-primary-warm-white text-sm font-semibold text-primary-comfy-ink transition-colors hover:bg-primary-comfy-yellow"
      @click="emit('done')"
    >
      {{ tc('cinematic.grade.done', locale) }}
    </button>
  </CinematicColors>
</template>
