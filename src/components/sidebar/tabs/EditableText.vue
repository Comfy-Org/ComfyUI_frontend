<template>
  <div class="editable-text">
    <span v-if="!isEditing" @dblclick="startEditing">
      {{ modelValue }}
    </span>
    <input
      v-else
      :value="modelValue"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
      @keyup.enter="finishEditing"
      @blur="finishEditing"
      ref="inputRef"
      v-focus
    />
  </div>
</template>

<script setup lang="ts">
import { ref, PropType, nextTick } from 'vue'

const props = defineProps({
  modelValue: {
    type: String as PropType<string>,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'edit'])

const isEditing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const startEditing = () => {
  isEditing.value = true
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const finishEditing = () => {
  isEditing.value = false
  emit('edit', props.modelValue)
}

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
