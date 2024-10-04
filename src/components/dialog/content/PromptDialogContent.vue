<template>
  <div class="prompt-dialog-content flex flex-col gap-2 pt-8">
    <FloatLabel>
      <InputText v-model="inputValue" @keyup.enter="onConfirm" />
      <label>{{ message }}</label>
    </FloatLabel>
    <Button @click="onConfirm">{{ $t('confirm') }}</Button>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import FloatLabel from 'primevue/floatlabel'
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
</script>
