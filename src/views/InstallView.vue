<template>
  <BaseViewTemplate dark>
    <!-- Fixed height container with flexbox layout for proper content management -->
    <div class="w-full h-full max-w-5xl mx-auto flex flex-col">
      <Stepper
        class="flex flex-col h-full p-8"
        value="0"
        @update:value="handleStepChange"
      >
        <!-- Main content area that grows to fill available space -->
        <StepPanels class="flex-1 overflow-auto">
          <StepPanel v-slot="{ activateCallback }" value="0">
            <div class="flex flex-col h-full">
              <div class="flex-1 flex items-center justify-center">
                <GpuPicker v-model:device="device" />
              </div>
              <div class="flex justify-center mt-8">
                <Button
                  label="Next"
                  class="w-96 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-lg"
                  :disabled="typeof device !== 'string'"
                  @click="activateCallback('1')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="1">
            <div class="flex flex-col h-full">
              <div class="flex-1 flex items-center justify-center">
                <InstallLocationPicker
                  v-model:install-path="installPath"
                  v-model:path-error="pathError"
                />
              </div>
              <div class="flex justify-between mt-8">
                <Button
                  :label="$t('g.back')"
                  severity="secondary"
                  icon="pi pi-arrow-left"
                  @click="activateCallback('0')"
                />
                <Button
                  :label="$t('g.next')"
                  icon="pi pi-arrow-right"
                  icon-pos="right"
                  :disabled="pathError !== ''"
                  @click="activateCallback('2')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="2">
            <div class="flex flex-col h-full">
              <div class="flex-1 flex items-center justify-center">
                <MigrationPicker
                  v-model:source-path="migrationSourcePath"
                  v-model:migration-item-ids="migrationItemIds"
                />
              </div>
              <div class="flex justify-between mt-8">
                <Button
                  :label="$t('g.back')"
                  severity="secondary"
                  icon="pi pi-arrow-left"
                  @click="activateCallback('1')"
                />
                <Button
                  :label="$t('g.next')"
                  icon="pi pi-arrow-right"
                  icon-pos="right"
                  @click="activateCallback('3')"
                />
              </div>
            </div>
          </StepPanel>
          <StepPanel v-slot="{ activateCallback }" value="3">
            <div class="flex flex-col h-full">
              <div
                class="flex-1 overflow-auto flex items-center justify-center"
              >
                <div>
                  <DesktopSettingsConfiguration
                    v-model:auto-update="autoUpdate"
                    v-model:allow-metrics="allowMetrics"
                  />
                  <MirrorsConfiguration
                    v-model:python-mirror="pythonMirror"
                    v-model:pypi-mirror="pypiMirror"
                    v-model:torch-mirror="torchMirror"
                    :device="device"
                    class="mt-6"
                  />
                </div>
              </div>
              <div class="flex justify-between mt-8">
                <Button
                  :label="$t('g.back')"
                  severity="secondary"
                  icon="pi pi-arrow-left"
                  @click="activateCallback('2')"
                />
                <Button
                  :label="$t('g.install')"
                  icon="pi pi-check"
                  icon-pos="right"
                  :disabled="hasError"
                  @click="install()"
                />
              </div>
            </div>
          </StepPanel>
        </StepPanels>

        <!-- Step indicators at the bottom -->
        <StepList
          class="flex justify-center items-center gap-3 py-8 select-none"
        >
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
      </Stepper>
    </div>
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
const install = async () => {
  const options: InstallOptions = {
    installPath: installPath.value,
    autoUpdate: autoUpdate.value,
    allowMetrics: allowMetrics.value,
    migrationSourcePath: migrationSourcePath.value,
    migrationItemIds: toRaw(migrationItemIds.value),
    pythonMirror: pythonMirror.value,
    pypiMirror: pypiMirror.value,
    torchMirror: torchMirror.value,
    // @ts-expect-error fixme ts strict error
    device: device.value
  }
  electron.installComfyUI(options)

  const nextPage =
    options.device === 'unsupported' ? '/manual-configuration' : '/server-start'
  await router.push(nextPage)
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
@reference '../assets/css/style.css';

:deep(.p-steppanel) {
  @apply bg-transparent;
}

/* Style step indicators as dots */
:deep(.p-stepper .p-step) {
  @apply flex-none p-0 m-0;
}

:deep(.p-stepper .p-step-header) {
  @apply p-0 border-0 bg-transparent;
  width: auto;
  min-width: unset;
}

:deep(.p-stepper .p-step-number) {
  @apply hidden;
}

:deep(.p-stepper .p-step-title) {
  @apply block w-2.5 h-2.5 rounded-full transition-all duration-300;
  background-color: #4a4a4a;
  font-size: 0;
  line-height: 0;
  overflow: hidden;
  text-indent: -9999px;
  padding: 0;
  margin: 0;
}

:deep(.p-stepper .p-step.p-step-active .p-step-title) {
  background-color: #facc15;
  @apply scale-110;
}

:deep(
    .p-stepper .p-step:not(.p-step-disabled) .p-step-header:hover .p-step-title
  ) {
  background-color: #6b6b6b;
  @apply scale-105;
}

:deep(.p-stepper .p-step.p-step-disabled .p-step-title) {
  background-color: #2a2a2a;
  @apply opacity-60;
  cursor: not-allowed;
}
</style>
