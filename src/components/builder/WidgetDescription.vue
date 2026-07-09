<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EditableText from '@/components/common/EditableText.vue'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useAppModeStore } from '@/stores/appModeStore'

const { t } = useI18n()
const { widget } = defineProps<{
  widget: IBaseWidget
  description?: string
  disabled?: boolean
}>()

const placeholder = computed(() =>
  t('linearMode.arrange.descriptionPlaceholder')
)

const isEditing = ref(false)
function onEditComplete(val: string) {
  isEditing.value = false
  const description = val && val !== placeholder.value ? val : undefined
  useAppModeStore().updateInputConfig(widget, { description })
}
</script>
<template>
  <EditableText
    :model-value="description || placeholder"
    :is-editing
    @dblclick="!disabled && (isEditing = true)"
    @edit="onEditComplete"
    @cancel="isEditing = false"
  />
</template>
