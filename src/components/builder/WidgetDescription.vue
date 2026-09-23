<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
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
  labelClass?: string
  labelType?: string
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
    :label-class="cn('truncate', labelClass)"
    :label-type
    @dblclick="!disabled && (isEditing = true)"
    @edit="onEditComplete"
    @cancel="isEditing = false"
  />
</template>
