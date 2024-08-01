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
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'edit'])

const inputValue = ref<string>(props.modelValue)
const isEditingFinished = ref<boolean>(false)

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
  min-width: 50px;
  padding: 2px;
  cursor: pointer;
}

.editable-text input {
  width: 100%;
  box-sizing: border-box;
}
</style>
