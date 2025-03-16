<template>
  <div class="px-4 py-2 h-full gap-2 flex flex-col">
    <h2 class="text-4xl font-normal my-0">
      {{ t('importModelDialog.title') }}
    </h2>
    <span class="text-muted">{{ path }}</span>
    <div class="flex flex-col gap-2 mt-4">
      <IftaLabel>
        <Select
          v-model="selectedType"
          :options="modelFolders"
          editable
          filter
          labelId="model-type"
          :disabled="importing"
        />
        <label for="model-type">Type</label>
      </IftaLabel>
    </div>
    <Message severity="error" v-if="importError">{{ importError }}</Message>
  </div>
  <footer>
    <div class="flex justify-between gap-2 p-4">
      <SelectButton
        v-model="selectedImportMode"
        optionLabel="label"
        optionValue="value"
        :options="importModes"
        :disabled="importing"
      />
      <div class="flex gap-2">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="dialogStore.closeDialog()"
          :disabled="importing"
        ></Button>
        <Button
          type="button"
          label="Import"
          @click="importModel()"
          :icon="importIcon"
          :loading="importing"
          :disabled="!selectedType"
        ></Button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import IftaLabel from 'primevue/iftalabel'
import Message from 'primevue/message'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useModelStore } from '@/stores/modelStore'
import { electronAPI } from '@/utils/envUtil'
import { guessModelType } from '@/utils/safetensorsUtil'

const { t } = useI18n()
const dialogStore = useDialogStore()
const { path, file } = defineProps<{
  path: string
  file: File
}>()

const importModes = ref([
  { label: t('importModelDialog.move'), value: 'move' },
  { label: t('importModelDialog.copy'), value: 'copy' }
])
const modelStore = useModelStore()
const modelFolders = ref<string[]>()
const selectedType = ref<string>()
const selectedImportMode = ref<string>('move')
const importing = ref<boolean>(false)
const importError = ref<string>()

const importIcon = computed(() => {
  return selectedImportMode.value === 'move'
    ? 'pi pi-file-import'
    : 'pi pi-copy'
})

const importModel = async () => {
  importing.value = true
  try {
    await electronAPI()?.['importModel'](
      file,
      selectedType.value,
      selectedImportMode.value
    )
    await useCommandStore().execute('Comfy.RefreshNodeDefinitions')
    dialogStore.closeDialog()
  } catch (error) {
    console.error(error)
    importError.value = error.message
  } finally {
    importing.value = false
  }
}

const init = async () => {
  if (!modelStore.modelFolders.length) {
    await modelStore.loadModelFolders()
  }

  modelFolders.value = modelStore.modelFolders.map((folder) => folder.directory)
  const type = await guessModelType(file)

  if (!selectedType.value) {
    selectedType.value = type
  }
}

init()
</script>
