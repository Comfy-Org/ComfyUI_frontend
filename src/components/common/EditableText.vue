<template>
  <div class="editable-text inline">
    <component :is="labelType" v-if="!isEditing" :class="labelClass">
      {{ modelValue }}
    </component>
    <Input
      v-else
      ref="inputRef"
      v-model="inputValue"
      v-focus
      type="text"
      class="h-full rounded-none p-0 focus-visible:ring-0"
      v-bind="inputAttrs"
      @blur="finishEditing"
      @keydown.enter.capture.stop="blurInputElement"
      @keydown.escape.capture.stop="cancelEditing"
      @click.stop
      @contextmenu.stop
      @pointerdown.stop.capture
      @pointermove.stop.capture
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import Input from '@/components/ui/input/Input.vue'

const {
  modelValue,
  isEditing = false,
  inputAttrs = {},
  labelClass = '',
  labelType = 'span'
} = defineProps<{
  modelValue: string
  isEditing?: boolean
  inputAttrs?: Record<string, string>
  labelClass?: string
  labelType?: string
}>()

const emit = defineEmits(['edit', 'cancel'])
const inputValue = ref<string>(modelValue)
const inputRef = ref<InstanceType<typeof Input>>()
const isCanceling = ref(false)

function blurInputElement() {
  inputRef.value?.blur()
}

function finishEditing() {
  if (!isCanceling.value) {
    emit('edit', inputValue.value)
  }
  isCanceling.value = false
}

function cancelEditing() {
  isCanceling.value = true
  inputValue.value = modelValue
  emit('cancel')
  blurInputElement()
}

watch(
  () => isEditing,
  async (newVal) => {
    if (newVal) {
      inputValue.value = modelValue
      await nextTick(() => {
        if (!inputRef.value) return
        const fileName = inputValue.value.includes('.')
          ? inputValue.value.split('.').slice(0, -1).join('.')
          : inputValue.value
        inputRef.value.setSelectionRange(0, fileName.length)
      })
    }
  },
  { immediate: true }
)

const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}
</script>
