<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import type { useCinematicEnhancement } from '../../../composables/useCinematicEnhancement'
import { tcEnhancement } from '../../../lib/workshop/cinematic-studio/enhancement-copy'
import Button from '../../ui/button/Button.vue'
const { run, accepted, locale } = defineProps<{
  run: ReturnType<typeof useCinematicEnhancement>
  accepted: boolean
  locale: Locale
}>()
const emit = defineEmits<{ close: []; back: []; apply: [] }>()
const {
  review,
  result,
  proposed,
  busy,
  error,
  canConfirm,
  unresolved,
  canRecover,
  gate
} = run
const t = (key: Parameters<typeof tcEnhancement>[0]) =>
  tcEnhancement(key, locale)
</script>
<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
    <Button variant="outline" @click="emit('close')">{{ t('cancel') }}</Button>
    <Button v-if="canRecover" variant="outline" @click="run.recover">{{
      t('recover')
    }}</Button>
    <Button
      v-if="!busy && !unresolved && (result || error)"
      variant="outline"
      @click="emit('back')"
      >{{ t('newRequest') }}</Button
    >
    <Button v-if="result" :disabled="!proposed" @click="emit('apply')">{{
      t('apply')
    }}</Button>
    <template v-else-if="review">
      <Button v-if="!busy" variant="outline" @click="emit('back')">{{
        t('back')
      }}</Button>
      <Button
        :disabled="!canConfirm || (!run.demo && !accepted)"
        @click="run.confirm(run.demo || accepted)"
        >{{ t(run.demo ? 'demoConfirm' : 'confirm') }}</Button
      >
    </template>
    <Button
      v-else-if="!error"
      :disabled="gate !== 'ready'"
      @click="run.prepare"
      >{{ t('review') }}</Button
    >
  </div>
</template>
