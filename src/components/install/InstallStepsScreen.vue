<template>
  <Stepper>
    <StepList>
      <Step value="1">Install location</Step>
      <Step value="2">Migration</Step>
      <Step value="3">Desktop settings</Step>
    </StepList>
    <StepPanels>
      <StepPanel>
        <InstallLocationPicker />
      </StepPanel>
      <StepPanel>
        <MigrationPicker />
      </StepPanel>
    </StepPanels>
  </Stepper>
</template>

<script setup lang="ts">
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import StepPanels from 'primevue/steppanels'
import Step from 'primevue/step'
import StepPanel from 'primevue/steppanel'

import InstallLocationPicker from '@/components/install/steps/InstallLocationPicker.vue'
import MigrationPicker from '@/components/install/steps/MigrationPicker.vue'
</script>
