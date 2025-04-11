<template>
  <div class="editable-text">
    <span v-if="!isEditing">
      {{ modelValue }}
    </span>
    <!-- Avoid double triggering finishEditing event when keyup.enter is triggered -->
    <InputText
      v-else
      ref="inputRef"
      v-model:modelValue="inputValue"
      v-focus
      type="text"
      size="small"
      fluid
      :pt="{
        root: {
          onBlur: finishEditing
        }
      }"
      @keyup.enter="blurInputElement"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { nextTick, ref, watch } from 'vue'

const { modelValue, isEditing = false } = defineProps<{
  modelValue: string
  isEditing?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'edit'])
const inputValue = ref<string>(modelValue)
const inputRef = ref<InstanceType<typeof InputText> | undefined>()

const blurInputElement = () => {
  // @ts-expect-error - $el is an internal property of the InputText component
  inputRef.value?.$el.blur()
}
const finishEditing = () => {
  emit('edit', inputValue.value)
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
        const start = 0
        const end = fileName.length
        // @ts-expect-error - $el is an internal property of the InputText component
        const inputElement = inputRef.value.$el
        inputElement.setSelectionRange?.(start, end)
      })
    }
  },
  { immediate: true }
)
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}
</script>

<style scoped>
.editable-text {
  display: inline;
}
.editable-text input {
  width: 100%;
  box-sizing: border-box;
}
</style>
