<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref, useTemplateRef } from 'vue'

import FormDropdownInput from './FormDropdownInput.vue'
import FormDropdownMenu from './FormDropdownMenu.vue'

const popoverRef = ref<InstanceType<typeof Popover>>()
const triggerRef = useTemplateRef('triggerRef')
const isOpen = ref(false)

const toggleDropdown = (event: Event) => {
  if (popoverRef.value && triggerRef.value) {
    popoverRef.value.toggle(event, triggerRef.value)
    isOpen.value = !isOpen.value
  }
}

const closeDropdown = () => {
  if (popoverRef.value) {
    popoverRef.value.hide()
    isOpen.value = false
  }
}

const files = ref<File[]>([])

// TODO handleFileChange
function handleFileChange(event: Event) {
  // 处理文件选择事件
  console.log('File selected:', event)
  const input = event.target as HTMLInputElement
  if (input.files) {
    files.value = Array.from(input.files)
    console.log('Selected files:', files.value)
  }
  // Clear the input value to allow re-selecting the same file
  input.value = ''
}
</script>

<template>
  <div ref="triggerRef">
    <FormDropdownInput
      :files="files"
      :is-open="isOpen"
      @select-click="toggleDropdown"
      @file-change="handleFileChange"
    />
    <Popover
      ref="popoverRef"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: {
          class: 'absolute z-50'
        },
        content: {
          class: ['bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg']
        }
      }"
      @hide="isOpen = false"
    >
      <FormDropdownMenu @close="closeDropdown" />
    </Popover>
  </div>
</template>
