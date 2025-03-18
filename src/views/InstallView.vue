<template>
  <BaseViewTemplate dark>
    <!-- h-full to make sure the stepper does not layout shift between steps
    as for each step the stepper height is different. Inherit the center element
    placement from BaseViewTemplate would cause layout shift. -->
    <Stepper
      class="h-full p-8 2xl:p-16"
      value="0"
      @update:value="handleStepChange"
    >
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
              :label="$t('g.next')"
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
              :label="$t('g.back')"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="activateCallback('0')"
            />
            <Button
              :label="$t('g.next')"
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
              :label="$t('g.back')"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="activateCallback('1')"
            />
            <Button
              :label="$t('g.next')"
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
          <MirrorsConfiguration
            :device="device"
            v-model:pythonMirror="pythonMirror"
            v-model:pypiMirror="pypiMirror"
            v-model:torchMirror="torchMirror"
            class="mt-6"
          />
          <div class="flex mt-6 justify-between">
            <Button
              :label="$t('g.back')"
              severity="secondary"
              icon="pi pi-arrow-left"
              @click="activateCallback('2')"
            />
            <Button
              :label="$t('g.install')"
              icon="pi pi-check"
              iconPos="right"
              :disabled="hasError"
              @click="install()"
            />
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import type {
  InstallOptions,
  TorchDeviceType
} from '@comfyorg/comfyui-electron-types'
import Button from 'primevue/button'
import Step from 'primevue/step'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import { computed, onMounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'

import DesktopSettingsConfiguration from '@/components/install/DesktopSettingsConfiguration.vue'
import GpuPicker from '@/components/install/GpuPicker.vue'
import InstallLocationPicker from '@/components/install/InstallLocationPicker.vue'
import MigrationPicker from '@/components/install/MigrationPicker.vue'
import MirrorsConfiguration from '@/components/install/MirrorsConfiguration.vue'
import { electronAPI } from '@/utils/envUtil'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const device = ref<TorchDeviceType | null>(null)

const installPath = ref('')
const pathError = ref('')

const migrationSourcePath = ref('')
const migrationItemIds = ref<string[]>([])

const autoUpdate = ref(true)
const allowMetrics = ref(true)
const pythonMirror = ref('')
const pypiMirror = ref('')
const torchMirror = ref('')

/** Forces each install step to be visited at least once. */
const highestStep = ref(0)

const handleStepChange = (value: string | number) => {
  setHighestStep(value)

  electronAPI().Events.trackEvent('install_stepper_change', {
    step: value
  })
}

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
    pythonMirror: pythonMirror.value,
    pypiMirror: pypiMirror.value,
    torchMirror: torchMirror.value,
    device: device.value
  }
  electron.installComfyUI(options)

  const nextPage =
    options.device === 'unsupported' ? '/manual-configuration' : '/server-start'
  router.push(nextPage)
}

onMounted(async () => {
  if (!electron) return

  const detectedGpu = await electron.Config.getDetectedGpu()
  if (detectedGpu === 'mps' || detectedGpu === 'nvidia') {
    device.value = detectedGpu
  }

  electronAPI().Events.trackEvent('install_stepper_change', {
    step: '0',
    gpu: detectedGpu
  })
})
</script>

<style scoped>
:deep(.p-steppanel) {
  @apply bg-transparent;
}
</style>
