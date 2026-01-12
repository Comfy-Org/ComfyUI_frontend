<template>
  <div class="prompt-dialog-content flex flex-col gap-2 pt-8">
    <FloatLabel>
      <InputText
        ref="inputRef"
        v-model="inputValue"
        :placeholder
        autofocus
        @keyup.enter="onConfirm"
        @focus="selectAllText"
      />
      <label>{{ message }}</label>
    </FloatLabel>
    <Button @click="onConfirm">
      {{ $t('g.confirm') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import FloatLabel from 'primevue/floatlabel'
import InputText from 'primevue/inputtext'
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

const props = defineProps<{
  message: string
  defaultValue: string
  onConfirm: (value: string) => void
  placeholder?: string
}>()

const inputValue = ref<string>(props.defaultValue)

const onConfirm = () => {
  props.onConfirm(inputValue.value)
  useDialogStore().closeDialog()
}

const inputRef = ref<
  (InstanceType<typeof InputText> & { $el?: HTMLElement }) | undefined
>()
const selectAllText = () => {
  const el = inputRef.value?.$el
  if (el instanceof HTMLInputElement) {
    el.setSelectionRange(0, el.value.length)
  }
}
</script>
