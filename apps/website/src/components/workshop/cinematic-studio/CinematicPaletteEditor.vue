<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import Button from '@/components/ui/button/Button.vue'
import CinematicColors from './CinematicColors.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t: tc } = translationsFor(locale)

const emit = defineEmits<{ done: [] }>()

const colors = defineModel<readonly string[]>('colors', { required: true })
const main = defineModel<number | undefined>('main')
</script>

<template>
  <CinematicColors v-model="colors" v-model:main="main" :locale>
    <Button variant="ghost" class="w-full rounded-full" @click="emit('done')">
      {{ tc('cinematic.grade.done') }}
    </Button>
  </CinematicColors>
</template>
