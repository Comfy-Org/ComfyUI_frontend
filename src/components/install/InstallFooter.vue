<template>
  <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
    <!-- Back button -->
    <Button
      v-if="currentStep !== '1'"
      :label="$t('g.back')"
      severity="secondary"
      icon="pi pi-arrow-left"
      class="px-6 py-2 justify-self-start"
      @click="$emit('previous')"
    />
    <div v-else></div>

    <!-- Step indicators in center -->
    <StepList class="flex justify-center items-center gap-3 select-none">
      <Step value="1">
        {{ $t('install.gpu') }}
      </Step>
      <Step value="2" :disabled="disableLocationStep">
        {{ $t('install.installLocation') }}
      </Step>
      <Step value="3" :disabled="disableMigrationStep">
        {{ $t('install.migration') }}
      </Step>
      <Step value="4" :disabled="disableSettingsStep">
        {{ $t('install.desktopSettings') }}
      </Step>
    </StepList>

    <!-- Next/Install button -->
    <Button
      :label="currentStep !== '4' ? $t('g.next') : $t('g.install')"
      class="px-8 py-2 bg-comfy-yellow hover:bg-comfy-yellow/90 text-neutral-900 font-bold transition-colors italic justify-self-end"
      :disabled="!canProceed"
      @click="currentStep !== '4' ? $emit('next') : $emit('install')"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'

defineProps<{
  /** Current step index as string ('1', '2', '3', '4') */
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

<style scoped>
@reference '../../assets/css/style.css';

/* Apply rounded corners to all buttons in the footer */
:deep(.p-button) {
  @apply rounded-lg border-0;
  font-family: 'ABC ROM Black Italic', sans-serif;
}

/* Style step indicators as dots */
:deep(.p-step) {
  @apply flex-none p-0 m-0;
}

:deep(.p-step-header) {
  @apply p-0 border-0 bg-transparent;
  width: auto;
  min-width: unset;
}

:deep(.p-step-number) {
  @apply hidden;
}

:deep(.p-step-title) {
  @apply block w-2.5 h-2.5 rounded-full transition-all duration-300;
  background-color: #4a4a4a;
  font-size: 0;
  line-height: 0;
  overflow: hidden;
  text-indent: -9999px;
  padding: 0;
  margin: 0;
}

:deep(.p-step.p-step-active .p-step-title) {
  @apply bg-comfy-yellow;
  width: 2rem;
  border-radius: 0.625rem;
}

:deep(.p-step:not(.p-step-disabled) .p-step-header:hover .p-step-title) {
  background-color: #6b6b6b;
  @apply scale-105;
}

:deep(.p-step.p-step-disabled .p-step-title) {
  background-color: #2a2a2a;
  @apply opacity-60;
  cursor: not-allowed;
}
</style>
