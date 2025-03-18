<!-- A generalized form item for rendering in a form. -->
<template>
  <div class="flex flex-row items-center gap-2">
    <div class="form-label flex flex-grow items-center">
      <span
        class="text-muted"
        :class="props.labelClass"
        :id="`${props.id}-label`"
      >
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
        :aria-labelledby="`${props.id}-label`"
        v-model:modelValue="formValue"
        v-bind="getFormAttrs(props.item)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { type Component, markRaw } from 'vue'

import CustomFormValue from '@/components/common/CustomFormValue.vue'
import FormColorPicker from '@/components/common/FormColorPicker.vue'
import FormImageUpload from '@/components/common/FormImageUpload.vue'
import InputKnob from '@/components/common/InputKnob.vue'
import InputSlider from '@/components/common/InputSlider.vue'
import UrlInput from '@/components/common/UrlInput.vue'
import { FormItem } from '@/types/settingTypes'

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

      if (typeof item.options?.[0] !== 'string') {
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
    case 'knob':
      return InputKnob
    case 'combo':
      return Select
    case 'image':
      return FormImageUpload
    case 'color':
      return FormColorPicker
    case 'url':
      return UrlInput
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

.form-input :deep(.input-knob) .p-inputnumber input,
.form-input :deep(.input-knob) .knob-part {
  @apply w-32;
}

.form-input :deep(.p-inputtext),
.form-input :deep(.p-select) {
  @apply w-44;
}
</style>
