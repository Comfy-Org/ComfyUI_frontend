<template>
  <div
    class="font-sans flex flex-col justify-center items-center h-screen m-0 text-neutral-300 bg-neutral-900"
  >
    <FirstTimeSetup
      v-if="showSetup"
      :initial-path="defaultInstallLocation"
      @complete="showSetup = false"
    />
    <ProgressOverlay v-else :status="status" :logs="logs" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProgressOverlay from './screens/ProgressOverlay.vue'
import FirstTimeSetup from './screens/FirstTimeSetup.vue'
import { ProgressStatus } from '@comfyorg/comfyui-electron-types'
import { electronAPI as getElectronAPI } from '@/utils/envUtil'

const electronAPI = getElectronAPI()

const showSetup = ref<boolean | null>(null)
const status = ref<ProgressStatus>(ProgressStatus.INITIAL_STATE)
const logs = ref<string[]>([])
const defaultInstallLocation = ref('')

const updateProgress = ({ status: newStatus }: { status: ProgressStatus }) => {
  status.value = newStatus
  logs.value = [] // Clear logs when status changes
}

const addLogMessage = (message: string) => {
  logs.value = [...logs.value, message]
}

onMounted(() => {
  electronAPI.sendReady()

  electronAPI.onShowSelectDirectory(() => {
    showSetup.value = true
  })

  electronAPI.onFirstTimeSetupComplete(() => {
    showSetup.value = false
  })

  electronAPI.onProgressUpdate(updateProgress)
  electronAPI.onLogMessage((message: string) => {
    addLogMessage(message)
  })

  electronAPI.onDefaultInstallLocation((location: string) => {
    defaultInstallLocation.value = location
  })
})
</script>
