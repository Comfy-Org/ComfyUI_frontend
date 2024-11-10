<template>
  <div class="flex flex-col gap-6 w-[600px]">
    <!-- Source Location Section -->
    <div class="flex flex-col gap-4">
      <h2 class="text-2xl font-semibold text-neutral-100">
        {{ $t('install.migrateFromExistingInstallation') }}
      </h2>

      <div class="flex gap-2">
        <InputText
          v-model="sourcePath"
          placeholder="Select existing ComfyUI installation (optional)"
          class="flex-1"
          :class="{ 'p-invalid': pathError }"
          @change="validateSource"
        />
        <Button icon="pi pi-folder" @click="browsePath" class="w-12" />
      </div>

      <small v-if="pathError" class="text-red-400">
        {{ pathError }}
      </small>
    </div>

    <!-- Migration Options -->
    <div
      v-if="isValidSource"
      class="flex flex-col gap-4 bg-neutral-800 p-4 rounded-lg"
    >
      <h3 class="text-lg font-medium text-neutral-100">
        {{ $t('install.selectItemsToMigrate') }}
      </h3>

      <div class="flex flex-col gap-3">
        <div
          v-for="item in migrationItems"
          :key="item.id"
          class="flex items-start gap-3 p-2 hover:bg-neutral-700 rounded"
        >
          <Checkbox v-model="item.selected" :inputId="item.id" :binary="true" />
          <div>
            <label :for="item.id" class="text-neutral-200 font-medium">
              {{ item.label }}
            </label>
            <p class="text-sm text-neutral-400 mt-1">
              {{ item.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Skip Migration -->
    <div v-else class="text-neutral-400 italic">
      {{ $t('install.migrationOptional') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { electronAPI } from '@/utils/envUtil'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

const electron = electronAPI() as any

const sourcePath = ref('')
const pathError = ref('')
const isValidSource = ref(false)

const migrationItems = reactive([
  {
    id: 'extra_paths',
    label: 'Custom Paths Configuration',
    description: 'Migrate extra_paths.yaml containing custom node locations',
    selected: true
  },
  {
    id: 'user_files',
    label: 'User Files',
    description: 'Migrate user-created workflows and custom nodes',
    selected: true
  },
  {
    id: 'custom_nodes',
    label: 'Custom Nodes',
    description: 'Migrate installed custom nodes and their configurations',
    selected: true
  }
])

const validateSource = async () => {
  if (!sourcePath.value) {
    isValidSource.value = false
    pathError.value = ''
    return
  }

  try {
    pathError.value = ''
    const validation = await electron.validateComfyUISource(sourcePath.value)

    if (validation.isValid) {
      isValidSource.value = true
    } else {
      isValidSource.value = false
      pathError.value = validation.error
    }
  } catch (error) {
    isValidSource.value = false
    pathError.value = 'Failed to validate source'
  }
}

const browsePath = async () => {
  try {
    const result = await electron.showDirectoryPicker()
    if (result) {
      sourcePath.value = result
      await validateSource()
    }
  } catch (error) {
    pathError.value = 'Failed to select directory'
  }
}

// Emit selected items when they change
watch(
  migrationItems,
  (items) => {
    emit('update:selection', {
      sourcePath: sourcePath.value,
      items: items.filter((item) => item.selected).map((item) => item.id)
    })
  },
  { deep: true }
)

const emit = defineEmits(['update:selection'])
</script>
