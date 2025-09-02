<template>
  <div
    class="flex flex-col gap-8 w-full max-w-3xl mx-auto h-[30rem] select-none"
  >
    <!-- Installation Path Section -->
    <div class="grow flex flex-col gap-6 text-neutral-300">
      <h2
        class="text-3xl text-neutral-100 text-center italic"
        style="font-family: 'ABC ROM Black Italic', sans-serif"
      >
        {{ $t('install.locationPicker.title') }}
      </h2>

      <p class="text-center text-neutral-400 px-12">
        {{ $t('install.locationPicker.subtitle') }}
      </p>

      <!-- Path Input -->
      <div class="flex gap-2 px-12">
        <InputText
          v-model="installPath"
          :placeholder="$t('install.locationPicker.pathPlaceholder')"
          class="flex-1 bg-neutral-800/50 border-neutral-700 text-neutral-200 placeholder:text-neutral-500"
          :class="{ 'p-invalid': pathError }"
          @update:model-value="validatePath"
          @focus="onFocus"
        />
        <Button
          icon="pi pi-folder-open"
          severity="secondary"
          class="bg-neutral-700 hover:bg-neutral-600 border-0"
          @click="browsePath"
        />
      </div>

      <!-- Error Messages -->
      <div v-if="pathError || pathExists || nonDefaultDrive" class="px-12">
        <Message
          v-if="pathError"
          severity="error"
          class="whitespace-pre-line w-full"
        >
          {{ pathError }}
        </Message>
        <Message v-if="pathExists" severity="warn" class="w-full">
          {{ $t('install.pathExists') }}
        </Message>
        <Message v-if="nonDefaultDrive" severity="warn" class="w-full">
          {{ $t('install.nonDefaultDrive') }}
        </Message>
      </div>

      <!-- Divider -->
      <Divider class="mx-12 border-neutral-700" />

      <!-- Collapsible Sections -->
      <div class="flex flex-col gap-0 px-12">
        <!-- Migration Section -->
        <button
          type="button"
          class="flex items-center gap-3 py-3 text-neutral-400 hover:text-neutral-300 transition-colors text-left w-full bg-transparent border-0 outline-none cursor-pointer"
          @click="showMigration = !showMigration"
        >
          <i
            class="text-xs transition-transform duration-200"
            :class="
              showMigration ? 'pi pi-chevron-down' : 'pi pi-chevron-right'
            "
          />
          <span>{{ $t('install.locationPicker.migrateFromExisting') }}</span>
        </button>
        <div v-if="showMigration" class="text-neutral-500 text-sm pb-3 pl-8">
          {{ $t('install.locationPicker.migrateDescription') }}
        </div>

        <!-- Download Servers Section -->
        <button
          type="button"
          class="flex items-center gap-3 py-3 text-neutral-400 hover:text-neutral-300 transition-colors text-left w-full bg-transparent border-0 outline-none cursor-pointer"
          @click="showDownloadServers = !showDownloadServers"
        >
          <i
            class="text-xs transition-transform duration-200"
            :class="
              showDownloadServers ? 'pi pi-chevron-down' : 'pi pi-chevron-right'
            "
          />
          <span>{{ $t('install.locationPicker.chooseDownloadServers') }}</span>
        </button>
        <div
          v-if="showDownloadServers"
          class="text-neutral-500 text-sm pb-3 pl-8"
        >
          {{ $t('install.locationPicker.downloadServersDescription') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { electronAPI } from '@/utils/envUtil'

const { t } = useI18n()

const installPath = defineModel<string>('installPath', { required: true })
const pathError = defineModel<string>('pathError', { required: true })
const pathExists = ref(false)
const nonDefaultDrive = ref(false)
const inputTouched = ref(false)

// Collapsible section states
const showMigration = ref(false)
const showDownloadServers = ref(false)

const electron = electronAPI()

// Get default install path on component mount
onMounted(async () => {
  const paths = await electron.getSystemPaths()
  installPath.value = paths.defaultInstallPath
  await validatePath(paths.defaultInstallPath)
})

const validatePath = async (path: string | undefined) => {
  try {
    pathError.value = ''
    pathExists.value = false
    nonDefaultDrive.value = false
    const validation = await electron.validateInstallPath(path ?? '')

    // Create a pre-formatted list of errors
    if (!validation.isValid) {
      const errors: string[] = []
      if (validation.cannotWrite) errors.push(t('install.cannotWrite'))
      if (validation.freeSpace < validation.requiredSpace) {
        const requiredGB = validation.requiredSpace / 1024 / 1024 / 1024
        errors.push(`${t('install.insufficientFreeSpace')}: ${requiredGB} GB`)
      }
      if (validation.parentMissing) errors.push(t('install.parentMissing'))
      if (validation.isOneDrive) errors.push(t('install.isOneDrive'))

      if (validation.error)
        errors.push(`${t('install.unhandledError')}: ${validation.error}`)
      pathError.value = errors.join('\n')
    }

    if (validation.isNonDefaultDrive) nonDefaultDrive.value = true
    if (validation.exists) pathExists.value = true
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

const onFocus = async () => {
  if (!inputTouched.value) {
    inputTouched.value = true
    return
  }
  // Refresh validation on re-focus
  await validatePath(installPath.value)
}
</script>

<style scoped>
/* Ensure button expanders have no default styling */
button[type='button'] {
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  padding: 0.75rem 0;
}

button[type='button']:focus {
  outline: none;
}

button[type='button']:hover {
  background: transparent;
}
</style>
