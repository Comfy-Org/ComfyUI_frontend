<template>
  <div class="editable-text">
    <span v-if="!props.isEditing">
      {{ modelValue }}
    </span>
    <InputText
      v-else
      type="text"
      size="small"
      fluid
      v-model:modelValue="inputValue"
      ref="inputRef"
      @keyup.enter="finishEditing"
      :pt="{
        root: {
          onBlur: finishEditing
        }
      }"
      v-focus
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { nextTick, ref, watch } from 'vue'

interface EditableTextProps {
  modelValue: string
  isEditing?: boolean
}

const props = withDefaults(defineProps<EditableTextProps>(), {
  isEditing: false
})

const emit = defineEmits(['update:modelValue', 'edit'])
const inputValue = ref<string>(props.modelValue)
const isEditingFinished = ref<boolean>(false)
const inputRef = ref(null)
const finishEditing = () => {
  if (isEditingFinished.value) {
    return
  }
  isEditingFinished.value = true
  emit('edit', inputValue.value)
}
watch(
  () => props.isEditing,
  (newVal) => {
    if (newVal) {
      inputValue.value = props.modelValue
      isEditingFinished.value = false
      nextTick(() => {
        if (!inputRef.value) return
        const fileName = inputValue.value.includes('.')
          ? inputValue.value.split('.').slice(0, -1).join('.')
          : inputValue.value
        const start = 0
        const end = fileName.length
        const inputElement = inputRef.value.$el
        inputElement.setSelectionRange(start, end)
      })
    }
  }
)
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}
</script>

<style scoped>
.editable-text {
  display: inline-block;
}
.editable-text input {
  width: 100%;
  box-sizing: border-box;
}
</style>
