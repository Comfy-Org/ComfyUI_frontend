<template>
  <div class="flex flex-col gap-6 w-[600px]">
    <!-- Installation Path Section -->
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        Choose Installation Location
      </h2>

      <div class="flex gap-2">
        <InputText
          v-model="installPath"
          class="flex-1"
          :class="{ 'p-invalid': pathError }"
          @change="validatePath"
        />
        <Button icon="pi pi-folder" @click="browsePath" class="w-12" />
      </div>

      <small v-if="pathError" class="text-red-400">
        {{ pathError }}
      </small>
    </div>

    <!-- System Paths Info -->
    <div class="bg-neutral-800 p-4 rounded-lg">
      <h3 class="text-lg font-medium mt-0 mb-3 text-neutral-100">
        System Locations
      </h3>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <i class="pi pi-folder text-neutral-400" />
          <span class="text-neutral-400">App Data:</span>
          <span class="text-neutral-200">{{ appData }}</span>
        </div>
        <div class="flex items-center gap-2">
          <i class="pi pi-desktop text-neutral-400" />
          <span class="text-neutral-400">App Path:</span>
          <span class="text-neutral-200">{{ appPath }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { electronAPI } from '@/utils/envUtil'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const installPath = ref('')
const pathError = ref('')
const appData = ref('')
const appPath = ref('')

// TODO: Implement the actual electron API.
const electron = electronAPI() as any

// Get system paths on component mount
onMounted(async () => {
  const paths = await electron.getSystemPaths()
  appData.value = paths.appData
  appPath.value = paths.appPath
  installPath.value = paths.defaultInstallPath
})

const validatePath = async () => {
  try {
    pathError.value = ''
    const validation = await electron.validateInstallPath(installPath.value)

    if (!validation.isValid) {
      pathError.value = validation.error
    }
  } catch (error) {
    pathError.value = 'Failed to validate path'
  }
}

const browsePath = async () => {
  try {
    const result = await electron.showDirectoryPicker()
    if (result) {
      installPath.value = result
      await validatePath()
    }
  } catch (error) {
    pathError.value = 'Failed to select directory'
  }
}

defineEmits(['update:path'])
</script>
