<template>
  <Dialog v-model:visible="visible" :header="'Customize Folder'">
    <div class="p-fluid">
      <div class="field">
        <label for="icon">Icon</label>
        <SelectButton
          v-model="selectedIcon"
          :options="iconOptions"
          optionLabel="name"
          dataKey="value"
        >
          <template #option="slotProps">
            <i
              :class="['pi', slotProps.option.value, 'mr-2']"
              :style="{ color: selectedColor.value }"
            ></i>
          </template>
        </SelectButton>
      </div>
      <Divider />
      <div class="field">
        <label for="color">Color</label>
        <SelectButton
          v-model="selectedColor"
          :options="colorOptions"
          optionLabel="name"
          dataKey="value"
        >
          <template #option="slotProps">
            <div
              :style="{
                width: '20px',
                height: '20px',
                backgroundColor: slotProps.option.value,
                borderRadius: '50%'
              }"
            ></div>
          </template>
        </SelectButton>
      </div>
    </div>
    <template #footer>
      <Button
        label="Reset"
        icon="pi pi-refresh"
        @click="resetCustomization"
        class="p-button-text"
      />
      <Button
        label="Cancel"
        icon="pi pi-times"
        @click="closeDialog"
        class="p-button-text"
      />
      <Button
        label="Confirm"
        icon="pi pi-check"
        @click="confirmCustomization"
        autofocus
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'

const props = defineProps<{
  modelValue: boolean
  initialIcon?: string
  initialColor?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', icon: string, color: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const nodeBookmarkStore = useNodeBookmarkStore()

const iconOptions = [
  { name: 'Bookmark', value: nodeBookmarkStore.defaultBookmarkIcon },
  { name: 'Folder', value: 'pi-folder' },
  { name: 'Star', value: 'pi-star' },
  { name: 'Heart', value: 'pi-heart' },
  { name: 'File', value: 'pi-file' },
  { name: 'Inbox', value: 'pi-inbox' },
  { name: 'Box', value: 'pi-box' },
  { name: 'Briefcase', value: 'pi-briefcase' }
]

const colorOptions = [
  { name: 'Default', value: nodeBookmarkStore.defaultBookmarkColor },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Blue', value: '#007bff' },
  { name: 'Green', value: '#28a745' },
  { name: 'Red', value: '#dc3545' },
  { name: 'Purple', value: '#6f42c1' },
  { name: 'Pink', value: '#e83e8c' },
  { name: 'Yellow', value: '#ffc107' }
]

const defaultIcon = iconOptions.find(
  (option) => option.value === nodeBookmarkStore.defaultBookmarkIcon
)
const defaultColor = colorOptions.find(
  (option) => option.value === nodeBookmarkStore.defaultBookmarkColor
)

const selectedIcon = ref<{ name: string; value: string }>(defaultIcon)
const selectedColor = ref<{ name: string; value: string }>(defaultColor)

const closeDialog = () => {
  visible.value = false
}

const confirmCustomization = () => {
  emit('confirm', selectedIcon.value.value, selectedColor.value.value)
  closeDialog()
}

const resetCustomization = () => {
  selectedIcon.value = iconOptions.find(
    (option) => option.value === (props.initialIcon || defaultIcon?.value)
  )
  selectedColor.value = colorOptions.find(
    (option) => option.value === (props.initialColor || defaultColor?.value)
  )
}

watch(
  () => props.modelValue,
  (newValue: boolean) => {
    if (newValue) {
      resetCustomization()
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.p-selectbutton .p-button {
  padding: 0.5rem;
}
.p-selectbutton .p-button .pi {
  font-size: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
