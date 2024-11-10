<template>
  <div
    class="font-sans flex flex-col items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <Stepper class="mt-[20vh]" value="1">
      <StepList>
        <Step value="1">Install location</Step>
        <Step value="2">Migration</Step>
        <Step value="3">Desktop settings</Step>
      </StepList>
      <StepPanels>
        <StepPanel value="1" v-slot="{ activateCallback }">
          <InstallLocationPicker
            :next-step-callback="() => activateCallback('2')"
          />
        </StepPanel>
        <StepPanel value="2">
          <MigrationPicker />
        </StepPanel>
        <StepPanel value="3">
          <DesktopSettingsConfiguration />
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>

<script setup lang="ts">
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import StepPanels from 'primevue/steppanels'
import Step from 'primevue/step'
import StepPanel from 'primevue/steppanel'

import InstallLocationPicker from '@/components/install/InstallLocationPicker.vue'
import MigrationPicker from '@/components/install/MigrationPicker.vue'
import DesktopSettingsConfiguration from '@/components/install/DesktopSettingsConfiguration.vue'
</script>

<style scoped>
:deep(.p-steppanel) {
  @apply bg-transparent;
}
</style>
