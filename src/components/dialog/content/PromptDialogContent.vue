<template>
  <div class="prompt-dialog-content flex flex-col gap-2 pt-8">
    <FloatLabel>
      <InputText
        ref="inputRef"
        v-model="inputValue"
        @keyup.enter="onConfirm"
        @focus="selectAllText"
        autofocus
      />
      <label>{{ message }}</label>
    </FloatLabel>
    <Button @click="onConfirm">{{ $t('g.confirm') }}</Button>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import FloatLabel from 'primevue/floatlabel'
import InputText from 'primevue/inputtext'
import { ref } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  defaultValue: string
  onConfirm: (value: string) => void
}>()

const inputValue = ref<string>(props.defaultValue)

const onConfirm = () => {
  props.onConfirm(inputValue.value)
  useDialogStore().closeDialog()
}

const inputRef = ref<InstanceType<typeof InputText> | undefined>()
const selectAllText = () => {
  if (!inputRef.value) return
  // @ts-expect-error - $el is an internal property of the InputText component
  const inputElement = inputRef.value.$el
  inputElement.setSelectionRange(0, inputElement.value.length)
}
</script>
