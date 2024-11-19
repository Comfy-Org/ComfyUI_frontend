<template>
  <div class="flex flex-col gap-6 w-[600px]">
    <!-- Installation Path Section -->
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.chooseInstallationLocation') }}
      </h2>

      <p class="text-neutral-400 my-0">
        {{ $t('install.installLocationDescription') }}
      </p>

      <div class="flex gap-2">
        <IconField class="flex-1">
          <InputText
            v-model="installPath"
            class="w-full"
            :class="{ 'p-invalid': pathError }"
            @change="validatePath"
          />
          <InputIcon
            class="pi pi-info-circle"
            v-tooltip="$t('install.installLocationTooltip')"
          />
        </IconField>
        <Button icon="pi pi-folder" @click="browsePath" class="w-12" />
      </div>

      <Message v-if="pathError" severity="error">
        {{ pathError }}
      </Message>
    </div>

    <!-- System Paths Info -->
    <div class="bg-neutral-800 p-4 rounded-lg">
      <h3 class="text-lg font-medium mt-0 mb-3 text-neutral-100">
        {{ $t('install.systemLocations') }}
      </h3>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <i class="pi pi-folder text-neutral-400" />
          <span class="text-neutral-400">App Data:</span>
          <span class="text-neutral-200">{{ appData }}</span>
          <span
            class="pi pi-info-circle"
            v-tooltip="$t('install.appDataLocationTooltip')"
          ></span>
        </div>
        <div class="flex items-center gap-2">
          <i class="pi pi-desktop text-neutral-400" />
          <span class="text-neutral-400">App Path:</span>
          <span class="text-neutral-200">{{ appPath }}</span>
          <span
            class="pi pi-info-circle"
            v-tooltip="$t('install.appPathLocationTooltip')"
          ></span>
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
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Message from 'primevue/message'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const installPath = defineModel<string>('installPath', { required: true })
const pathError = defineModel<string>('pathError', { required: true })
const appData = ref('')
const appPath = ref('')

const electron = electronAPI()

// Get system paths on component mount
onMounted(async () => {
  const paths = await electron.getSystemPaths()
  appData.value = paths.appData
  appPath.value = paths.appPath
  installPath.value = paths.defaultInstallPath

  await validatePath(paths.defaultInstallPath)
})

const validatePath = async (path: string) => {
  try {
    pathError.value = ''
    const validation = await electron.validateInstallPath(path)

    if (!validation.isValid) {
      pathError.value = validation.error
    }
  } catch (error) {
    pathError.value = t('install.pathValidationFailed')
  }
}

const browsePath = async () => {
  try {
    const result = await electron.showDirectoryPicker()
    if (result) {
      installPath.value = result
      await validatePath(result)
    }
  } catch (error) {
    pathError.value = t('install.failedToSelectDirectory')
  }
}
</script>
