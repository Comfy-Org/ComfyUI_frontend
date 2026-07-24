<template>
  <div class="color-picker-wrapper flex items-center gap-2">
    <ColorPicker
      :id="id"
      v-model="hexValue"
      :disabled="disabled"
      :aria-labelledby="ariaLabelledby"
    />
    <Input
      v-model="draftText"
      class="w-28"
      :placeholder="label"
      :disabled="disabled"
      @blur="commitDraft"
      @keydown.enter="commitDraft"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ColorPicker from '@/components/ui/color-picker/ColorPicker.vue'
import Input from '@/components/ui/input/Input.vue'

const modelValue = defineModel<string>('modelValue')
const {
  disabled = false,
  id,
  ariaLabelledby
} = defineProps<{
  label?: string
  disabled?: boolean
  id?: string
  ariaLabelledby?: string
}>()

defineOptions({
  inheritAttrs: false
})

// Preserve the PrimeVue ColorPicker storage contract (hex without `#`); the
// underlying picker uses `#`-prefixed hex, so normalize on read/write.
const hexValue = computed<string>({
  get: () =>
    modelValue.value?.startsWith('#')
      ? modelValue.value
      : `#${modelValue.value ?? '000000'}`,
  set: (next) => {
    modelValue.value = next.replace(/^#/, '')
  }
})

// Free-text draft so partial typing (e.g. "#f") doesn't roundtrip through
// the picker and snap back to black. Only commit on blur or Enter when the
// input fully parses as 6- or 8-digit hex.
const draftText = ref(modelValue.value ?? '')
watch(modelValue, (next) => {
  draftText.value = next ?? ''
})

const FULL_HEX = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i

function commitDraft() {
  const raw = draftText.value.trim()
  if (raw === '') {
    draftText.value = modelValue.value ?? ''
    return
  }
  if (FULL_HEX.test(raw)) {
    modelValue.value = raw.replace(/^#/, '').toLowerCase()
  } else {
    draftText.value = modelValue.value ?? ''
  }
}
</script>
