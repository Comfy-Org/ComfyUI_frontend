<template>
  <Dialog v-model:visible="visible" :header="$t('g.customizeFolder')">
    <div class="p-fluid">
      <div class="field icon-field">
        <label for="icon">{{ $t('g.icon') }}</label>
        <SelectButton
          v-model="selectedIcon"
          :options="iconOptions"
          optionLabel="name"
          dataKey="value"
        >
          <template #option="slotProps">
            <i
              :class="['pi', slotProps.option.value, 'mr-2']"
              :style="{ color: finalColor }"
            ></i>
          </template>
        </SelectButton>
      </div>
      <Divider />
      <div class="field color-field">
        <label for="color">{{ $t('g.color') }}</label>
        <div class="color-picker-container">
          <SelectButton
            v-model="selectedColor"
            :options="colorOptions"
            optionLabel="name"
            dataKey="value"
          >
            <template #option="slotProps">
              <div
                v-if="slotProps.option.value !== 'custom'"
                :style="{
                  width: '20px',
                  height: '20px',
                  backgroundColor: slotProps.option.value,
                  borderRadius: '50%'
                }"
              ></div>
              <i
                v-else
                class="pi pi-palette"
                :style="{ fontSize: '1.2rem' }"
                v-tooltip="$t('g.customColor')"
              ></i>
            </template>
          </SelectButton>
          <ColorPicker
            v-if="selectedColor.value === 'custom'"
            v-model="customColor"
          />
        </div>
      </div>
    </div>
    <template #footer>
      <Button
        :label="$t('g.reset')"
        icon="pi pi-refresh"
        @click="resetCustomization"
        class="p-button-text"
      />
      <Button
        :label="$t('g.confirm')"
        icon="pi pi-check"
        @click="confirmCustomization"
        autofocus
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import ColorPicker from 'primevue/colorpicker'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'

const { t } = useI18n()

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
  { name: t('icon.bookmark'), value: nodeBookmarkStore.defaultBookmarkIcon },
  { name: t('icon.folder'), value: 'pi-folder' },
  { name: t('icon.star'), value: 'pi-star' },
  { name: t('icon.heart'), value: 'pi-heart' },
  { name: t('icon.file'), value: 'pi-file' },
  { name: t('icon.inbox'), value: 'pi-inbox' },
  { name: t('icon.box'), value: 'pi-box' },
  { name: t('icon.briefcase'), value: 'pi-briefcase' }
]

const colorOptions = [
  { name: t('color.default'), value: nodeBookmarkStore.defaultBookmarkColor },
  { name: t('color.blue'), value: '#007bff' },
  { name: t('color.green'), value: '#28a745' },
  { name: t('color.red'), value: '#dc3545' },
  { name: t('color.pink'), value: '#e83e8c' },
  { name: t('color.yellow'), value: '#ffc107' },
  { name: t('color.custom'), value: 'custom' }
]

const defaultIcon = iconOptions.find(
  (option) => option.value === nodeBookmarkStore.defaultBookmarkIcon
)
const defaultColor = colorOptions.find(
  (option) => option.value === nodeBookmarkStore.defaultBookmarkColor
)

const selectedIcon = ref<{ name: string; value: string }>(defaultIcon)
const selectedColor = ref<{ name: string; value: string }>(defaultColor)
const finalColor = computed(() =>
  selectedColor.value.value === 'custom'
    ? `#${customColor.value}`
    : selectedColor.value.value
)

const customColor = ref('000000')

const closeDialog = () => {
  visible.value = false
}

const confirmCustomization = () => {
  emit('confirm', selectedIcon.value.value, finalColor.value)
  closeDialog()
}

const resetCustomization = () => {
  selectedIcon.value =
    iconOptions.find((option) => option.value === props.initialIcon) ||
    defaultIcon
  const colorOption = colorOptions.find(
    (option) => option.value === props.initialColor
  )
  if (!props.initialColor) {
    selectedColor.value = defaultColor
  } else if (!colorOption) {
    customColor.value = props.initialColor.replace('#', '')
    selectedColor.value = { name: t('color.custom'), value: 'custom' }
  } else {
    selectedColor.value = colorOption
  }
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

.color-picker-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
