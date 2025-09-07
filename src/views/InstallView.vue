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
                v-model:migrationSourcePath="migrationSourcePath"
                v-model:migrationItemIds="migrationItemIds"
                v-model:pythonMirror="pythonMirror"
                v-model:pypiMirror="pypiMirror"
                v-model:torchMirror="torchMirror"
                :device="device"
              />
            </div>
          </StepPanel>
          <StepPanel value="2">
            <div class="flex items-center justify-center h-full">
              <!-- Migration step is empty - content moved to accordion in step 2 -->
              <div class="text-neutral-400 text-center">
                <p>{{ $t('install.migrationStepEmpty') }}</p>
              </div>
            </div>
          </StepPanel>
          <StepPanel value="3">
            <div class="flex items-center justify-center h-full">
              <DesktopSettingsConfiguration
                v-model:autoUpdate="autoUpdate"
                v-model:allowMetrics="allowMetrics"
              />
            </div>
          </StepPanel>
        </StepPanels>

        <!-- Install footer with navigation -->
        <InstallFooter
          class="pt-6 pb-4 max-w-2xl mx-auto w-full"
          :current-step
          :can-proceed
          :disable-location-step="noGpu"
          :disable-migration-step="noGpu || hasError || highestStep < 1"
          :disable-settings-step="noGpu || hasError || highestStep < 2"
          @previous="goToPreviousStep"
          @next="goToNextStep"
          @install="install"
        />
      </Stepper>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import type {
  InstallOptions,
  TorchDeviceType
} from '@comfyorg/comfyui-electron-types'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
import { computed, onMounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'

import DesktopSettingsConfiguration from '@/components/install/DesktopSettingsConfiguration.vue'
import GpuPicker from '@/components/install/GpuPicker.vue'
import InstallFooter from '@/components/install/InstallFooter.vue'
import InstallLocationPicker from '@/components/install/InstallLocationPicker.vue'
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
      return true // Migration step is now empty, always allow proceeding
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
</style>
