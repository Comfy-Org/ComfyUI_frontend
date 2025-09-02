<template>
  <div class="flex justify-between items-center pt-6 pb-4">
    <!-- Back button -->
    <Button
      v-if="currentStep !== '0'"
      :label="$t('g.back')"
      severity="secondary"
      icon="pi pi-arrow-left"
      class="px-6 py-2"
      @click="$emit('previous')"
    />
    <div v-else class="w-24"></div>

    <!-- Step indicators in center -->
    <StepList class="flex justify-center items-center gap-3 select-none">
      <Step value="0">
        {{ $t('install.gpu') }}
      </Step>
      <Step value="1" :disabled="disableLocationStep">
        {{ $t('install.installLocation') }}
      </Step>
      <Step value="2" :disabled="disableMigrationStep">
        {{ $t('install.migration') }}
      </Step>
      <Step value="3" :disabled="disableSettingsStep">
        {{ $t('install.desktopSettings') }}
      </Step>
    </StepList>

    <!-- Next/Install button -->
    <Button
      :label="currentStep !== '3' ? $t('g.next') : $t('g.install')"
      class="px-8 py-2 bg-comfy-yellow hover:bg-comfy-yellow/90 text-neutral-900 font-bold transition-colors italic"
      style="font-family: 'ABC ROM Black Italic', sans-serif"
      :disabled="!canProceed"
      @click="currentStep !== '3' ? $emit('next') : $emit('install')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'

defineProps<{
  /** Current step index as string ('0', '1', '2', '3') */
  currentStep: string
  /** Whether the user can proceed to the next step */
  canProceed: boolean
  /** Whether the location step should be disabled */
  disableLocationStep: boolean
  /** Whether the migration step should be disabled */
  disableMigrationStep: boolean
  /** Whether the settings step should be disabled */
  disableSettingsStep: boolean
}>()

defineEmits<{
  previous: []
  next: []
  install: []
}>()
</script>
