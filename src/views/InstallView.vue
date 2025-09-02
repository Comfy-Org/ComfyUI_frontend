<template>
  <BaseViewTemplate dark>
    <!-- Fixed height container with flexbox layout for proper content management -->
    <div class="w-full h-full max-w-5xl mx-auto flex flex-col">
      <Stepper
        v-model:value="currentStep"
        class="flex flex-col h-full p-8"
        @update:value="handleStepChange"
      >
        <!-- Main content area that grows to fill available space -->
        <StepPanels class="flex-1 overflow-auto">
          <StepPanel value="0">
            <div class="flex items-center justify-center h-full">
              <GpuPicker v-model:device="device" />
            </div>
          </StepPanel>
          <StepPanel value="1">
            <div class="flex items-center justify-center h-full">
              <InstallLocationPicker
                v-model:install-path="installPath"
                v-model:path-error="pathError"
              />
            </div>
          </StepPanel>
          <StepPanel value="2">
            <div class="flex items-center justify-center h-full">
              <MigrationPicker
                v-model:source-path="migrationSourcePath"
                v-model:migration-item-ids="migrationItemIds"
              />
            </div>
          </StepPanel>
          <StepPanel value="3">
            <div class="flex items-center justify-center h-full">
              <div class="overflow-auto">
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
          </StepPanel>
        </StepPanels>

        <!-- Bottom navigation section with buttons and step indicators -->
        <div class="flex flex-col gap-6 pt-6">
          <!-- Navigation buttons -->
          <div class="flex justify-between items-center">
            <Button
              v-if="currentStep !== '0'"
              :label="$t('g.back')"
              severity="secondary"
              icon="pi pi-arrow-left"
              class="px-6 py-2"
              @click="goToPreviousStep"
            />
            <div v-else class="w-24"></div>

            <!-- Center space for potential future content -->
            <div class="flex-1"></div>

            <Button
              v-if="currentStep !== '3'"
              :label="$t('g.next')"
              class="px-8 py-3 bg-comfy-yellow hover:bg-comfy-yellow/90 text-neutral-900 font-bold rounded-lg transition-colors italic"
              style="font-family: 'ABC ROM Black Italic', sans-serif"
              :disabled="!canProceed"
              @click="goToNextStep"
            />
            <Button
              v-else
              :label="$t('g.install')"
              class="px-8 py-3 bg-comfy-yellow hover:bg-comfy-yellow/90 text-neutral-900 font-bold rounded-lg transition-colors italic"
              style="font-family: 'ABC ROM Black Italic', sans-serif"
              :disabled="!canProceed"
              @click="install()"
            />
          </div>

          <!-- Step indicators -->
          <StepList
            class="flex justify-center items-center gap-3 pb-4 select-none"
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
        </div>
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

/** Current step in the stepper */
const currentStep = ref('0')

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

// Computed property to determine if user can proceed to next step
const canProceed = computed(() => {
  switch (currentStep.value) {
    case '0':
      return typeof device.value === 'string'
    case '1':
      return pathError.value === ''
    case '2':
      return true // Migration is optional
    case '3':
      return !hasError.value
    default:
      return false
  }
})

// Navigation methods
const goToNextStep = () => {
  const nextStep = (parseInt(currentStep.value) + 1).toString()
  currentStep.value = nextStep
  setHighestStep(nextStep)
  electronAPI().Events.trackEvent('install_stepper_change', {
    step: nextStep
  })
}

const goToPreviousStep = () => {
  const prevStep = (parseInt(currentStep.value) - 1).toString()
  currentStep.value = prevStep
  electronAPI().Events.trackEvent('install_stepper_change', {
    step: prevStep
  })
}

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
    step: currentStep.value,
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
  @apply bg-comfy-yellow scale-110;
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
