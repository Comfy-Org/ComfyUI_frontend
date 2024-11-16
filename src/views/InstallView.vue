<template>
  <div
    class="font-sans flex flex-col items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <Stepper class="mt-[5vh] 2xl:mt-[20vh]" value="1">
      <StepList>
        <Step value="1" :disabled="hasError">
          {{ $t('install.installLocation') }}
        </Step>
        <Step value="2" :disabled="hasError">
          {{ $t('install.migration') }}
        </Step>
        <Step value="3" :disabled="hasError">
          {{ $t('install.desktopSettings') }}
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel value="1" v-slot="{ activateCallback }">
          <InstallLocationPicker
            v-model:installPath="installPath"
            v-model:pathError="pathError"
          />
          <div class="flex pt-6 justify-end">
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              @click="activateCallback('2')"
              :disabled="pathError !== ''"
            />
          </div>
        </StepPanel>
        <StepPanel value="2" v-slot="{ activateCallback }">
          <MigrationPicker
            v-model:sourcePath="migrationSourcePath"
            v-model:migrationItemIds="migrationItemIds"
          />
          <div class="flex pt-6 justify-between">
            <Button
              label="Back"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="activateCallback('1')"
            />
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              @click="activateCallback('3')"
            />
          </div>
        </StepPanel>
        <StepPanel value="3" v-slot="{ activateCallback }">
          <DesktopSettingsConfiguration
            v-model:autoUpdate="autoUpdate"
            v-model:allowMetrics="allowMetrics"
          />
          <div class="flex pt-6 justify-between">
            <Button
              label="Back"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="activateCallback('2')"
            />
            <Button
              label="Install"
              icon="pi pi-check"
              iconPos="right"
              @click="install()"
            />
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Stepper from 'primevue/stepper'
import StepList from 'primevue/steplist'
import StepPanels from 'primevue/steppanels'
import Step from 'primevue/step'
import StepPanel from 'primevue/steppanel'

import InstallLocationPicker from '@/components/install/InstallLocationPicker.vue'
import MigrationPicker from '@/components/install/MigrationPicker.vue'
import DesktopSettingsConfiguration from '@/components/install/DesktopSettingsConfiguration.vue'
import { electronAPI } from '@/utils/envUtil'
import { ref, computed, toRaw } from 'vue'
import { useRouter } from 'vue-router'

const installPath = ref('')
const pathError = ref('')

const migrationSourcePath = ref('')
const migrationItemIds = ref<string[]>([])

const autoUpdate = ref(true)
const allowMetrics = ref(true)

const hasError = computed(() => pathError.value !== '')

const router = useRouter()
const install = () => {
  const options = toRaw({
    installPath: installPath.value,
    autoUpdate: autoUpdate.value,
    allowMetrics: allowMetrics.value,
    migrationSourcePath: migrationSourcePath.value,
    migrationItemIds: toRaw(migrationItemIds.value)
  })
  electronAPI().installComfyUI(options)
  router.push('/server-start')
}
</script>

<style scoped>
:deep(.p-steppanel) {
  @apply bg-transparent;
}
</style>
