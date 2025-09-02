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

      <!-- Collapsible Sections using PrimeVue Accordion -->
      <div class="px-12">
        <Accordion 
          :value="activeAccordionIndex"
          @update:value="activeAccordionIndex = $event"
          :multiple="true"
          class="location-picker-accordion"
          pt:root="bg-transparent border-0"
          pt:accordionPanel="border-0"
          pt:accordionHeader="bg-transparent border-0 text-neutral-400 hover:text-neutral-300 px-0 py-3"
          pt:accordionHeaderAction="flex items-center gap-3 w-full"
          pt:accordionToggleIcon="text-xs"
          pt:accordionContent="bg-transparent border-0"
          pt:accordionContentContainer="text-neutral-500 text-sm pl-8 pb-3 pt-0"
        >
          <AccordionPanel value="0">
            <AccordionHeader>
              {{ $t('install.locationPicker.migrateFromExisting') }}
            </AccordionHeader>
            <AccordionContent>
              {{ $t('install.locationPicker.migrateDescription') }}
            </AccordionContent>
          </AccordionPanel>
          
          <AccordionPanel value="1">
            <AccordionHeader>
              {{ $t('install.locationPicker.chooseDownloadServers') }}
            </AccordionHeader>
            <AccordionContent>
              {{ $t('install.locationPicker.downloadServersDescription') }}
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
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

// Accordion state - null means all collapsed
const activeAccordionIndex = ref<string[]>([])

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
/* Style the accordion to match the mockup */
:deep(.location-picker-accordion) {
  .p-accordionpanel {
    border: none;
    background: transparent;
  }

  .p-accordionheader {
    background: transparent;
    border: none;
    
    .p-accordionheader-toggle-icon {
      order: -1; /* Move icon to the left */
    }
  }

  .p-accordioncontent {
    background: transparent;
    border: none;
  }
}
</style>
