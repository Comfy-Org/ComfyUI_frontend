<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Button from '../../ui/button/Button.vue'
import CinematicColors from './CinematicColors.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const emit = defineEmits<{ done: [] }>()

const colors = defineModel<readonly string[]>('colors', { required: true })
const main = defineModel<number | undefined>('main')
</script>

<template>
  <CinematicColors v-model="colors" v-model:main="main" :locale>
    <Button variant="outline" class="w-full" @click="emit('done')">
      {{ tc('cinematic.grade.done', locale) }}
    </Button>
  </CinematicColors>
</template>
