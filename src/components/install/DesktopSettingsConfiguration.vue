<template>
  <div class="flex flex-col gap-6 w-[600px]">
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        Desktop App Settings
      </h2>

      <p class="text-neutral-400">
        Configure how ComfyUI behaves on your desktop. You can change these
        settings later.
      </p>
    </div>

    <div class="flex flex-col gap-6 bg-neutral-800 p-4 rounded-lg">
      <!-- Auto Update Setting -->
      <div class="flex items-start gap-4">
        <div class="flex-1">
          <h3 class="text-lg font-medium text-neutral-100">
            Automatic Updates
          </h3>
          <p class="text-sm text-neutral-400 mt-1">
            Automatically download and install updates when they become
            available. You'll always be notified before updates are installed.
          </p>
        </div>
        <InputSwitch v-model="settings.autoUpdate" @change="updateSettings" />
      </div>

      <!-- Metrics Collection Setting -->
      <div class="flex items-start gap-4">
        <div class="flex-1">
          <h3 class="text-lg font-medium text-neutral-100">Usage Analytics</h3>
          <p class="text-sm text-neutral-400 mt-1">
            Help improve ComfyUI by sending anonymous usage data. No personal
            information or workflow content will be collected.
          </p>
          <a
            href="#"
            class="text-sm text-blue-400 hover:text-blue-300 mt-1 inline-block"
            @click.prevent="showMetricsInfo"
          >
            Learn more about data collection
          </a>
        </div>
        <InputSwitch v-model="settings.allowMetrics" @change="updateSettings" />
      </div>
    </div>

    <!-- Info Dialog -->
    <Dialog
      v-model:visible="showDialog"
      modal
      header="About Data Collection"
      :style="{ width: '50vw' }"
    >
      <div class="text-neutral-300">
        <h4 class="font-medium mb-2">What we collect:</h4>
        <ul class="list-disc pl-6 space-y-1">
          <li>Application start and close events</li>
          <li>Feature usage statistics</li>
          <li>Error reports</li>
          <li>Operating system and app version</li>
        </ul>

        <h4 class="font-medium mt-4 mb-2">What we don't collect:</h4>
        <ul class="list-disc pl-6 space-y-1">
          <li>Personal information</li>
          <li>Workflow contents or images</li>
          <li>File system information</li>
          <li>Custom node configurations</li>
        </ul>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { electronAPI } from '@/utils/envUtil'
import InputSwitch from 'primevue/inputswitch'
import Dialog from 'primevue/dialog'

const showDialog = ref(false)
const settings = reactive({
  autoUpdate: true,
  allowMetrics: true
})

const electron = electronAPI() as any

// Load saved settings on mount
onMounted(async () => {
  try {
    const savedSettings = await electron.getSettings()
    settings.autoUpdate = savedSettings.autoUpdate
    settings.allowMetrics = savedSettings.allowMetrics
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
})

const updateSettings = async () => {
  try {
    await electron.saveSettings({
      autoUpdate: settings.autoUpdate,
      allowMetrics: settings.allowMetrics
    })
    emit('update:settings', settings)
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

const showMetricsInfo = () => {
  showDialog.value = true
}

const emit = defineEmits(['update:settings'])
</script>
