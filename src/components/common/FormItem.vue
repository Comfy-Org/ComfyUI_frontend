<!-- A generalized form item for rendering in a form. -->
<template>
  <div class="form-label flex flex-grow items-center">
    <span class="text-muted" :class="props.labelClass">
      <slot name="name-prefix"></slot>
      {{ props.item.name }}
      <i
        v-if="props.item.tooltip"
        class="pi pi-info-circle bg-transparent"
        v-tooltip="props.item.tooltip"
      />
      <slot name="name-suffix"></slot>
    </span>
  </div>
  <div class="form-input flex justify-end">
    <component
      :is="markRaw(getFormComponent(props.item))"
      :id="props.id"
      v-model:modelValue="formValue"
      v-bind="getFormAttrs(props.item)"
    />
  </div>
</template>

<script setup lang="ts">
import { FormItem } from '@/types/settingTypes'
import { markRaw, type Component } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import CustomFormValue from '@/components/common/CustomFormValue.vue'
import InputSlider from '@/components/common/InputSlider.vue'

const formValue = defineModel<any>('formValue')
const props = defineProps<{
  item: FormItem
  id?: string
  labelClass?: string | Record<string, boolean>
}>()

function getFormAttrs(item: FormItem) {
  const attrs = { ...(item.attrs || {}) }
  const inputType = item.type
  if (typeof inputType === 'function') {
    attrs['renderFunction'] = () =>
      inputType(
        props.item.name,
        (v: any) => (formValue.value = v),
        formValue.value,
        item.attrs
      )
  }
  switch (item.type) {
    case 'combo':
      attrs['options'] =
        typeof item.options === 'function'
          ? // @ts-expect-error: Audit and deprecate usage of legacy options type:
            // (value) => [string | {text: string, value: string}]
            item.options(formValue.value)
          : item.options

      if (typeof item.options[0] !== 'string') {
        attrs['optionLabel'] = 'text'
        attrs['optionValue'] = 'value'
      }
      break
  }
  return attrs
}

function getFormComponent(item: FormItem): Component {
  if (typeof item.type === 'function') {
    return CustomFormValue
  }
  switch (item.type) {
    case 'boolean':
      return ToggleSwitch
    case 'number':
      return InputNumber
    case 'slider':
      return InputSlider
    case 'combo':
      return Select
    default:
      return InputText
  }
}
</script>

<style scoped>
.form-input :deep(.input-slider) .p-inputnumber input,
.form-input :deep(.input-slider) .slider-part {
  @apply w-20;
}

.form-input :deep(.p-inputtext),
.form-input :deep(.p-select) {
  @apply w-44;
}
</style>
