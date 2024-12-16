<template>
  <div
    class="font-sans flex flex-col items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <Stepper class="stepper" value="0" @update:value="setHighestStep">
      <StepList class="select-none">
        <Step value="0">
          {{ $t('install.gpu') }}
        </Step>
        <Step value="1" :disabled="noGpu">
          {{ $t('install.installLocation') }}
        </Step>
        <Step value="2" :disabled="noGpu || hasError || highestStep < 1">
          {{ $t('install.migration') }}
        </Step>
        <Step value="3" :disabled="noGpu || hasError || highestStep < 2">
          {{ $t('install.desktopSettings') }}
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel value="0" v-slot="{ activateCallback }">
          <GpuPicker v-model:device="device" />
          <div class="flex pt-6 justify-end">
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              @click="activateCallback('1')"
              :disabled="typeof device !== 'string'"
            />
          </div>
        </StepPanel>
        <StepPanel value="1" v-slot="{ activateCallback }">
          <InstallLocationPicker
            v-model:installPath="installPath"
            v-model:pathError="pathError"
          />
          <div class="flex pt-6 justify-between">
            <Button
              label="Back"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="activateCallback('0')"
            />
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
              :disabled="hasError"
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
import {
  electronAPI,
  type InstallOptions,
  type TorchDeviceType
} from '@/utils/envUtil'
import { ref, computed, toRaw, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import GpuPicker from '@/components/install/GpuPicker.vue'

const device = ref<TorchDeviceType>(null)

const installPath = ref('')
const pathError = ref('')

const migrationSourcePath = ref('')
const migrationItemIds = ref<string[]>([])

const autoUpdate = ref(true)
const allowMetrics = ref(true)

/** Forces each install step to be visited at least once. */
const highestStep = ref(0)

const setHighestStep = (value: string | number) => {
  const int = typeof value === 'number' ? value : parseInt(value, 10)
  if (!isNaN(int) && int > highestStep.value) highestStep.value = int
}

const hasError = computed(() => pathError.value !== '')
const noGpu = computed(() => typeof device.value !== 'string')

const electron = electronAPI()
const router = useRouter()
const install = () => {
  const options: InstallOptions = {
    installPath: installPath.value,
    autoUpdate: autoUpdate.value,
    allowMetrics: allowMetrics.value,
    migrationSourcePath: migrationSourcePath.value,
    migrationItemIds: toRaw(migrationItemIds.value),
    device: device.value
  }
  electron.installComfyUI(options)
  router.push('/server-start')
}

onMounted(async () => {
  if (!electron) return

  const detectedGpu = await electron.Config.getDetectedGpu()
  if (detectedGpu === 'mps' || detectedGpu === 'nvidia')
    device.value = detectedGpu
})
</script>

<style lang="postcss" scoped>
:deep(.p-steppanel) {
  @apply bg-transparent;
}

.stepper {
  margin-top: max(1rem, max(0px, calc((100vh - 42rem) * 0.5)));
}
</style>
